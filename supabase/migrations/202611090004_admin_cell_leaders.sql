begin;
create or replace function videira_private.validate_cell_links() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.organization_id<>old.organization_id) then raise exception 'Identidade da célula não pode ser alterada'; end if;
 if new.leader_id is not null and not exists(select 1 from videira.profiles p where p.id=new.leader_id and p.active and p.organization_id=new.organization_id and (p.role in ('master','supervisor') or (p.role='lider' and p.church_id=new.church_id and p.network_id=new.network_id))) then raise exception 'Selecione um líder da mesma igreja/rede ou um Master/Pastor Supervisor ativo da organização'; end if;
 if new.discipler_id is not null and not exists(select 1 from videira.profiles p where p.id=new.discipler_id and p.active and p.role='discipulador' and p.organization_id=new.organization_id and p.church_id=new.church_id and p.network_id=new.network_id) then raise exception 'Discipulador deve pertencer à mesma igreja e rede'; end if;
 return new;
end $$;
create or replace function videira.record_meeting(p_cell_id uuid,p_date date,p_attendance jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c videira.cells; meeting_uuid uuid; payload_size integer; expected_size integer; converted integer;
begin
 if auth.uid() is null or not videira_private.can_cell(p_cell_id) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if exists(select 1 from videira.profiles where id=auth.uid() and role in ('master','supervisor')) and not exists(select 1 from videira.cells where id=p_cell_id and leader_id=auth.uid()) then raise exception 'Para registrar a chamada, vincule esta conta como líder da célula' using errcode='42501';end if;
 select * into c from videira.cells where id=p_cell_id and active for update;
 if not found then raise exception 'Célula indisponível'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Maceio')::date then raise exception 'Data do encontro inválida'; end if;
 if exists(select 1 from videira.meetings where cell_id=p_cell_id and meeting_date>=p_date) then raise exception 'Registre os encontros em ordem, sem repetir a data'; end if;
 if p_attendance is null or jsonb_typeof(p_attendance)<>'array' then raise exception 'Lista de presença inválida'; end if;
 payload_size=jsonb_array_length(p_attendance);
 if payload_size=0 or payload_size>5000 then raise exception 'Informe os participantes do encontro'; end if;
 if exists(select 1 from jsonb_array_elements(p_attendance) x where jsonb_typeof(x)<>'object' or jsonb_typeof(x->'person_id') is distinct from 'string' or jsonb_typeof(x->'present') is distinct from 'boolean') then raise exception 'Cada participante deve ter identificador e presença válida'; end if;
 if payload_size<>(select count(distinct x.person_id) from jsonb_to_recordset(p_attendance) as x(person_id uuid,present boolean)) then raise exception 'Participante repetido'; end if;
 perform 1 from videira.people where cell_id=p_cell_id and active for update;
 select count(*) into expected_size from videira.people where cell_id=p_cell_id and active;
 if expected_size<>payload_size or exists(select 1 from jsonb_to_recordset(p_attendance) as x(person_id uuid,present boolean) left join videira.people p on p.id=x.person_id and p.cell_id=p_cell_id and p.active where p.id is null) then raise exception 'A lista de pessoas mudou. Atualize a tela e tente novamente'; end if;
 insert into videira.meetings(organization_id,cell_id,meeting_date,recorded_by)
 values(c.organization_id,c.id,p_date,auth.uid()) returning id into meeting_uuid;
 insert into videira.attendance(meeting_id,cell_id,person_id,present)
 select meeting_uuid,c.id,x.person_id,x.present from jsonb_to_recordset(p_attendance) as x(person_id uuid,present boolean);
 update videira.people p set category='Membro'
 where p.cell_id=c.id and p.active and p.category='Visitante' and
 (select count(*) from videira.meetings m join videira.attendance a on a.meeting_id=m.id and a.person_id=p.id
  where m.id in(select recent.id from videira.meetings recent where recent.cell_id=c.id order by recent.meeting_date desc limit 3) and a.present)=3;
 get diagnostics converted=row_count;
 return jsonb_build_object('meeting_id',meeting_uuid,'converted',converted,'present',(select count(*) from jsonb_to_recordset(p_attendance) as x(person_id uuid,present boolean) where x.present));
end $$;
revoke all on function videira_private.validate_cell_links() from public,anon,authenticated;
revoke all on function videira.record_meeting(uuid,date,jsonb) from public,anon;
grant execute on function videira.record_meeting(uuid,date,jsonb) to authenticated;
commit;
