begin;
-- Worship calls are independent of cell meetings and never change membership categories.
create table if not exists videira_private.worship_calls (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 cell_id uuid not null, service_date date not null, service text not null check(service in ('morning','evening')),
 discipler_id uuid, recorded_by uuid not null references videira.profiles(id),
 revision integer not null default 1, updated_at timestamptz not null default now(),
 unique(cell_id,service_date,service), unique(id,cell_id),
 foreign key(cell_id,organization_id) references videira.cells(id,organization_id)
);
create table if not exists videira_private.worship_attendance (
 call_id uuid not null, cell_id uuid not null, person_id uuid not null references videira.people(id),
 present boolean not null, category text not null check(category in ('Líder','Membro','Visitante')),
 primary key(call_id,person_id), foreign key(call_id,cell_id) references videira_private.worship_calls(id,cell_id)
);
alter table videira_private.worship_calls enable row level security;
alter table videira_private.worship_attendance enable row level security;
revoke all on videira_private.worship_calls,videira_private.worship_attendance from public,anon,authenticated;
create index if not exists worship_calls_date on videira_private.worship_calls(service_date,cell_id);

create or replace function videira_private.can_record_worship(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from videira.cells c join videira.profiles p on p.organization_id=c.organization_id
 where c.id=target and c.active and p.id=auth.uid() and p.active and p.registration_deleted_at is null
 and (c.discipler_id=p.id or (c.leader_id=p.id and not exists(
  select 1 from videira.profiles d where d.organization_id=c.organization_id and d.church_id=c.church_id
   and d.role='discipulador' and d.active and d.registration_deleted_at is null
 ))));
$$;
create or replace function videira_private.can_report_worship(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from videira.profiles p join videira.cells c on c.organization_id=p.organization_id
 where p.id=auth.uid() and p.active and p.registration_deleted_at is null and c.id=target
 and p.role in ('master','supervisor','supervisora_kids','predio','pastor','obreiro','discipulador')
 and case when p.role='discipulador' then c.discipler_id=p.id
  when p.role in ('predio','obreiro') then c.church_id=p.church_id
  else videira_private.can_report_cell(c.id) end);
$$;
revoke all on function videira_private.can_record_worship(uuid),videira_private.can_report_worship(uuid) from public,anon,authenticated;

create or replace function public.videira_worship(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me videira.profiles; locked_cell videira.cells; call_data jsonb; existing videira_private.worship_calls;
 saved_call_id uuid; target_date date; target_service text; supplied_count integer; expected_count integer;
 start_date date; end_date date; result jsonb; saved integer:=0;
begin
 select * into me from videira.profiles where id=auth.uid() and active and registration_deleted_at is null;
 if not found then raise insufficient_privilege;end if;
 if p_action='scope' then
  return (with scoped as materialized(select c.* from videira.cells c where c.organization_id=me.organization_id and
    (videira_private.can_record_worship(c.id) or videira_private.can_report_worship(c.id)))
   select jsonb_build_object('can_report',me.role in ('master','supervisor','supervisora_kids','predio','pastor','obreiro','discipulador'),
    'cells',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'church_id',c.church_id,'network_id',c.network_id,'leader_id',c.leader_id,'discipler_id',c.discipler_id,'can_record',videira_private.can_record_worship(c.id)) order by c.name),'[]'::jsonb) from scoped c),
    'churches',(select coalesce(jsonb_agg(jsonb_build_object('id',ch.id,'name',ch.name) order by ch.name),'[]'::jsonb) from videira.churches ch where exists(select 1 from scoped c where c.church_id=ch.id)),
    'networks',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'name',n.name,'church_id',n.church_id) order by n.name),'[]'::jsonb) from videira.networks n where exists(select 1 from scoped c where c.network_id=n.id)),
    'disciplers',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.display_name) order by d.display_name),'[]'::jsonb) from videira.profiles d where exists(select 1 from scoped c where c.discipler_id=d.id))));
 elsif p_action='roster' then
  target_date:=(p_data->>'date')::date;target_service:=p_data->>'service';
  if target_date is null or target_date>(now() at time zone 'America/Maceio')::date or target_service is null or target_service not in ('morning','evening') then raise exception 'Confira a data e o culto';end if;
  return (with scoped as materialized(select c.* from videira.cells c where videira_private.can_record_worship(c.id)
    and (nullif(p_data->>'cell','') is null or c.id=(p_data->>'cell')::uuid))
   select jsonb_build_object(
    'calls',(select coalesce(jsonb_agg(jsonb_build_object('cell_id',c.id,'revision',coalesce(w.revision,0))),'[]'::jsonb) from scoped c left join videira_private.worship_calls w on w.cell_id=c.id and w.service_date=target_date and w.service=target_service),
    'people',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'cell_id',p.cell_id,'full_name',p.full_name,'category',case when p.id=link.member_id or c.leader_id=link.profile_id then 'Líder' else p.category::text end,'present',a.present) order by p.full_name,p.id),'[]'::jsonb)
     from videira.people p join scoped c on c.id=p.cell_id
     left join videira_private.member_leader_access link on link.member_id=p.id and link.profile_id=c.leader_id
     left join videira_private.worship_calls w on w.cell_id=c.id and w.service_date=target_date and w.service=target_service
     left join videira_private.worship_attendance a on a.call_id=w.id and a.person_id=p.id where p.active)));
 elsif p_action='photo' then
  return (select jsonb_build_object('photo_base64',encode(photo.jpeg,'base64')) from videira.people p join videira_private.person_photos photo on photo.person_id=p.id
    where p.id=(p_data->>'id')::uuid and p.active and videira_private.can_record_worship(p.cell_id));
 elsif p_action='save' then
  target_date:=(p_data->>'date')::date;target_service:=p_data->>'service';
  if target_date is null or target_date>(now() at time zone 'America/Maceio')::date or target_service is null or target_service not in ('morning','evening') then raise exception 'Confira a data e o culto';end if;
  if jsonb_typeof(p_data->'calls') is distinct from 'array' or jsonb_array_length(p_data->'calls') not between 1 and 1000 then raise exception 'Lista de células inválida';end if;
  if (select count(distinct x->>'cell_id') from jsonb_array_elements(p_data->'calls') x)<>jsonb_array_length(p_data->'calls') then raise exception 'Célula repetida';end if;
  -- Sorted cell locks serialize edits and prevent partially saved multi-cell calls.
  for call_data in select value from jsonb_array_elements(p_data->'calls') order by value->>'cell_id' loop
   select * into locked_cell from videira.cells where id=(call_data->>'cell_id')::uuid for update;
   if not found or not videira_private.can_record_worship(locked_cell.id) then raise insufficient_privilege;end if;
   select * into existing from videira_private.worship_calls where cell_id=locked_cell.id and service_date=target_date and service=target_service for update;
   if coalesce(existing.revision,0) is distinct from (call_data->>'revision')::integer then raise exception 'Outra pessoa atualizou a chamada. Recarregue antes de salvar.' using errcode='40001';end if;
   if jsonb_typeof(call_data->'people') is distinct from 'array' then raise exception 'Lista de pessoas inválida';end if;
   supplied_count:=jsonb_array_length(call_data->'people');
   if supplied_count not between 1 and 5000 or exists(select 1 from jsonb_array_elements(call_data->'people') x where jsonb_typeof(x->'person_id') is distinct from 'string' or jsonb_typeof(x->'present') is distinct from 'boolean') then raise exception 'Marque presença ou falta para todas as pessoas';end if;
   perform 1 from videira.people where cell_id=locked_cell.id and active for update;
   select count(*) into expected_count from videira.people where cell_id=locked_cell.id and active;
   if expected_count<>supplied_count or supplied_count<>(select count(distinct x->>'person_id') from jsonb_array_elements(call_data->'people') x) or exists(select 1 from jsonb_to_recordset(call_data->'people') x(person_id uuid,present boolean) left join videira.people p on p.id=x.person_id and p.cell_id=locked_cell.id and p.active where p.id is null) then raise exception 'A lista de pessoas mudou. Recarregue a chamada.';end if;
   insert into videira_private.worship_calls(organization_id,cell_id,service_date,service,discipler_id,recorded_by)
    values(locked_cell.organization_id,locked_cell.id,target_date,target_service,locked_cell.discipler_id,me.id)
    on conflict(cell_id,service_date,service) do update set revision=videira_private.worship_calls.revision+1,updated_at=now(),recorded_by=me.id returning id into saved_call_id;
   insert into videira_private.worship_attendance(call_id,cell_id,person_id,present,category)
    select saved_call_id,locked_cell.id,p.id,x.present,case when exists(select 1 from videira_private.member_leader_access l where l.member_id=p.id and l.profile_id=locked_cell.leader_id) then 'Líder' else p.category::text end
    from jsonb_to_recordset(call_data->'people') x(person_id uuid,present boolean) join videira.people p on p.id=x.person_id
    on conflict(call_id,person_id) do update set present=excluded.present;
   insert into videira.audit_log(organization_id,actor_id,action,entity,entity_id) values(me.organization_id,me.id,'save','worship_calls',saved_call_id::text);
   saved:=saved+1;
  end loop;
  return jsonb_build_object('saved',saved);
 elsif p_action='report' then
  if me.role not in ('master','supervisor','supervisora_kids','predio','pastor','obreiro','discipulador') then raise insufficient_privilege;end if;
  start_date:=(p_data->>'from')::date;end_date:=(p_data->>'to')::date;
  if start_date is null or end_date is null or start_date>end_date or end_date-start_date>366 then raise exception 'Selecione um período de até um ano';end if;
  target_service:=nullif(p_data->>'service','');
  if target_service is not null and target_service not in ('morning','evening') then raise exception 'Culto inválido';end if;
  return (with scoped as materialized(select c.* from videira.cells c where videira_private.can_report_worship(c.id)
    and (nullif(p_data->>'church','') is null or c.church_id=(p_data->>'church')::uuid)
    and (nullif(p_data->>'network','') is null or c.network_id=(p_data->>'network')::uuid)
    and (nullif(p_data->>'cell','') is null or c.id=(p_data->>'cell')::uuid)
    and (nullif(p_data->>'discipler','') is null or c.discipler_id=(p_data->>'discipler')::uuid)),
   calls as materialized(select w.* from videira_private.worship_calls w join scoped c on c.id=w.cell_id where w.service_date between start_date and end_date and (target_service is null or w.service=target_service)),
   people as (select p.id,p.cell_id from videira.people p join scoped c on c.id=p.cell_id where p.active union select a.person_id,a.cell_id from videira_private.worship_attendance a join calls w on w.id=a.call_id),
   rows as (select p.id,p.full_name,p.phone,c.id as cell_id,c.name as cell_name,
     case when exists(select 1 from videira_private.member_leader_access l where l.member_id=p.id and l.profile_id=c.leader_id) then 'Líder' else p.category::text end as category,
     count(*) filter(where a.present) as presences,count(*) filter(where a.present=false) as absences
    from people ids join videira.people p on p.id=ids.id join scoped c on c.id=ids.cell_id
    left join calls w on w.cell_id=c.id left join videira_private.worship_attendance a on a.call_id=w.id and a.person_id=p.id
    group by p.id,c.id,c.name,c.leader_id)
   select jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(r) order by r.full_name,r.id,r.cell_id),'[]'::jsonb) from rows r),
    'services',(select count(distinct (c.church_id,w.service_date,w.service)) from calls w join scoped c on c.id=w.cell_id)));
 else raise exception 'Operação desconhecida';end if;
end $$;
revoke all on function public.videira_worship(text,jsonb) from public,anon;
grant execute on function public.videira_worship(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
