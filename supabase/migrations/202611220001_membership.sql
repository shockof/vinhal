begin;
alter table videira.people add column if not exists encounter_with_god boolean not null default false;
-- Keep the internal enum compatible with attendance, access and existing reports.
create or replace function videira_private.membership_label(category videira.person_category, encounter boolean)
returns text language sql immutable set search_path='' as $$
 select case when encounter then 'Membro da igreja' when category='Membro' then 'Membro da célula' else 'Visitante' end
$$;
revoke all on function videira_private.membership_label(videira.person_category,boolean) from public,anon;
grant execute on function videira_private.membership_label(videira.person_category,boolean) to authenticated;
create or replace function videira_private.promote_fourth_attendance()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.present then
  perform 1 from videira.people where id=new.person_id for update;
  update videira.people p set category='Membro' where p.id=new.person_id and p.active and p.category='Visitante'
   and (select count(*) from videira.attendance a join videira.meetings m on m.id=a.meeting_id
    where a.person_id=p.id and a.present and m.deleted_at is null)>=4;
 end if;
 return null;
end $$;
revoke all on function videira_private.promote_fourth_attendance() from public,anon,authenticated;
create trigger promote_fourth_attendance after insert or update of present on videira.attendance
for each row execute function videira_private.promote_fourth_attendance();
update videira.people p set category='Membro' where p.active and p.category='Visitante'
 and (select count(*) from videira.attendance a join videira.meetings m on m.id=a.meeting_id
 where a.person_id=p.id and a.present and m.deleted_at is null)>=4;

do $migration$
declare d text; original text;
begin
 d:=pg_get_functiondef('public.videira_my_profile(text,jsonb)'::regprocedure);
 execute replace(d,'''username'',me.username,','''username'',me.username,''card_name'',me.card_name,');
 d:=pg_get_functiondef('public.videira_discipleship(date,uuid,text,boolean)'::regprocedure);
 d:=regexp_replace(d,'if p_course=''maturidade'' and person.category=''Visitante'' then.*?end if;','','is');
 d:=replace(d,'p.category,p.baptized','p.category,p.encounter_with_god,p.baptized');
 d:=replace(d,'''baptized'',p.baptized','''encounter_with_god'',p.encounter_with_god,''baptized'',p.baptized');
 original:=$old$case when p.category='Membro' then 'Membro' when a.total_present>=3 and cardinality(k.courses)=0 then 'Frequentador assíduo' else 'Visitante' end$old$;
 if strpos(d,original)=0 then raise exception 'Revise a regra de categoria antes de publicar'; end if;
 d:=replace(d,original,'videira_private.membership_label(p.category,p.encounter_with_god)');
 execute d;
 d:=pg_get_functiondef('public.videira_portal(text,jsonb)'::regprocedure);
 if strpos(d,'select p.*,p.id in')=0 then raise exception 'Revise a consulta de membros'; end if;
 execute replace(d,'select p.*,p.id in','select p.*,videira_private.membership_label(p.category,p.encounter_with_god) as membership_status,p.id in');
end $migration$;
create or replace function public.videira_discipleship_person_field(p_person uuid,p_field text,p_value text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me videira.profiles; target uuid;
begin
 select * into me from videira.profiles where id=auth.uid() and active;
 if not found or me.role not in ('master','discipulador') then raise insufficient_privilege; end if;
 if p_field is null or p_value is null or p_field not in ('encounter_with_god','baptized','is_tither')
 or p_value not in ('Sim','Não','Não informado') then raise exception 'Seleção inválida'; end if;
 update videira.people p set
 encounter_with_god=case when p_field='encounter_with_god' then p_value='Sim' else p.encounter_with_god end,
 category=case when p_field='encounter_with_god' and p_value='Sim' then 'Membro'::videira.person_category else p.category end,
 baptized=case when p_field='baptized' then p_value else p.baptized end,
 is_tither=case when p_field='is_tither' then case p_value when 'Sim' then true when 'Não' then false end else p.is_tither end
 from videira.cells c where p.id=p_person and p.active and p.organization_id=me.organization_id and p.cell_id=c.id
 and (me.role='master' or c.discipler_id=me.id) and videira_private.can_cell(c.id) returning p.id into target;
 if target is null then raise insufficient_privilege; end if;
 return jsonb_build_object('ok',true);
end $$;
notify pgrst,'reload schema';
commit;
