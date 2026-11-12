begin;

create table videira_private.cell_trainee (
 cell_id uuid primary key references videira.cells(id) on delete cascade,
 person_id uuid not null references videira.people(id) on delete cascade
);
alter table videira_private.cell_trainee enable row level security;
revoke all on videira_private.cell_trainee from public,anon,authenticated;

create function videira_private.cell_trainees() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(t.cell_id,t.person_id),'{}'::jsonb)
 from videira_private.cell_trainee t
 join videira.cells c on c.id=t.cell_id and c.active
 where c.leader_id=auth.uid() and videira_private.can_cell(c.id)
$$;

create function videira_private.set_cell_trainee(cell uuid,person uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 -- Lock the cell before the person, matching the attendance write order.
 perform 1 from videira.cells c where c.id=cell and c.active
  and c.leader_id=auth.uid() and videira_private.can_cell(c.id) for no key update;
 if not found then raise insufficient_privilege; end if;
 if person is not null then
  perform 1 from videira.people p where p.id=person and p.cell_id=cell
   and p.active and p.category='Membro' for update;
  if not found then raise exception 'Escolha um membro ativo desta célula.'; end if;
 end if;
 if person is null then
  delete from videira_private.cell_trainee where cell_id=cell;
 else
  insert into videira_private.cell_trainee(cell_id,person_id) values(cell,person)
   on conflict(cell_id) do update set person_id=excluded.person_id;
 end if;
 return jsonb_build_object('person_id',person);
end $$;

create function videira_private.clear_ineligible_trainee() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.cell_id is distinct from old.cell_id or not new.active or new.category<>'Membro' then
  delete from videira_private.cell_trainee where person_id=old.id;
 end if;
 return new;
end $$;
create trigger clear_ineligible_trainee after update of cell_id,active,category on videira.people
 for each row execute function videira_private.clear_ineligible_trainee();

revoke all on function videira_private.cell_trainees(),videira_private.set_cell_trainee(uuid,uuid) from public,anon;
grant execute on function videira_private.cell_trainees(),videira_private.set_cell_trainee(uuid,uuid) to authenticated;
revoke all on function videira_private.clear_ineligible_trainee() from public,anon,authenticated;

create or replace function public.videira_portal(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare me videira.profiles; target uuid; destination uuid; photo_bytes bytea;
begin
 select * into me from videira.profiles where id=auth.uid() and active;
 if me.id is null then raise exception 'Acesso indisponível' using errcode='42501'; end if;
 if p_action='birthdays' then
  return videira_private.monthly_birthdays();
 elsif p_action='load' then
  return jsonb_build_object('profile',to_jsonb(me),
   'cell_trainees',videira_private.cell_trainees(),
   'churches',coalesce((select jsonb_agg(t) from (select * from videira.churches order by name)t),'[]'),
   'networks',coalesce((select jsonb_agg(t) from (select * from videira.networks order by name)t),'[]'),
   'cells',coalesce((select jsonb_agg(t) from (select * from videira.cells where active order by name)t),'[]'),
   'people',coalesce((select jsonb_agg(t) from (select * from videira.people where active order by full_name)t),'[]'),
   'cell_leadership',public.videira_cell_leadership(),
   'profiles',coalesce((select jsonb_agg(t) from (select id,username,display_name,role,church_id,network_id,active from videira.profiles order by display_name)t),'[]'),
   'meetings',coalesce((select jsonb_agg(t) from (select * from videira.meetings where deleted_at is null order by meeting_date)t),'[]'),
   'archived_meetings',coalesce((select jsonb_agg(t) from (select id,cell_id,meeting_date,deleted_at from videira.meetings where deleted_at is not null and videira_private.can_manage_calls(cell_id) order by meeting_date desc)t),'[]'),
   'attendance',coalesce((select jsonb_agg(t) from videira.attendance t),'[]'));
 elsif p_action='church' then
  if me.role not in ('master','supervisor') then raise insufficient_privilege; end if;
  if nullif(trim(p_data->>'municipality'),'') is null then raise exception 'Informe o município'; end if;
  if p_data->>'id' is null then
   insert into videira.churches(organization_id,name,municipality) values(me.organization_id,trim(p_data->>'name'),trim(p_data->>'municipality')) returning id into target;
  else
   update videira.churches set name=trim(p_data->>'name'),municipality=trim(p_data->>'municipality') where id=(p_data->>'id')::uuid returning id into target;
  end if;
 elsif p_action='network' then
  if me.role not in ('master','supervisor','predio') then raise insufficient_privilege; end if;
  if p_data->>'id' is null then
   insert into videira.networks(organization_id,church_id,name,kind) values(me.organization_id,(p_data->>'church_id')::uuid,trim(p_data->>'name'),coalesce(p_data->>'kind','regular')) returning id into target;
  else
   update videira.networks set name=trim(p_data->>'name'),kind=p_data->>'kind' where id=(p_data->>'id')::uuid returning id into target;
  end if;
 elsif p_action='cell' then
  if me.role not in ('master','supervisor','predio') then raise insufficient_privilege; end if;
  if p_data->>'id' is null then
   insert into videira.cells(organization_id,church_id,network_id,name,meeting_schedule,private_address,latitude,longitude,leader_id,discipler_id,address_details)
   values(me.organization_id,(p_data->>'church_id')::uuid,(p_data->>'network_id')::uuid,trim(p_data->>'name'),p_data->>'meeting_schedule',p_data->>'private_address',nullif(p_data->>'latitude','')::float8,nullif(p_data->>'longitude','')::float8,nullif(p_data->>'leader_id','')::uuid,nullif(p_data->>'discipler_id','')::uuid,coalesce(p_data->'address_details','{}'::jsonb)) returning id into target;
  else
   update videira.cells set name=trim(p_data->>'name'),meeting_schedule=p_data->>'meeting_schedule',private_address=p_data->>'private_address',latitude=nullif(p_data->>'latitude','')::float8,longitude=nullif(p_data->>'longitude','')::float8,leader_id=nullif(p_data->>'leader_id','')::uuid,discipler_id=nullif(p_data->>'discipler_id','')::uuid,address_details=coalesce(p_data->'address_details',address_details)
   where id=(p_data->>'id')::uuid returning id into target;
  end if;
 elsif p_action='person_photo' then
  if not exists(select 1 from videira.people where id=(p_data->>'id')::uuid and active) then
   raise insufficient_privilege;
  end if;
  return jsonb_build_object('photo_base64',(
   select replace(encode(jpeg,'base64'),chr(10),'')
   from videira_private.person_photos where person_id=(p_data->>'id')::uuid
  ));
 elsif p_action='person' then
  destination:=nullif(p_data->>'cell_id','')::uuid;
  if p_data->>'id' is null then
   insert into videira.people(organization_id,cell_id,full_name,phone,category,baptized,marital_status,birth_date)
   values(me.organization_id,(p_data->>'cell_id')::uuid,trim(p_data->>'full_name'),p_data->>'phone',(p_data->>'category')::videira.person_category,p_data->>'baptized',p_data->>'marital_status',videira_private.parse_birth_date(p_data->>'birth_date')) returning id into target;
  else
   if destination is not null and not exists(
    select 1 from videira.cells where id=destination and active and organization_id=me.organization_id
   ) then raise exception 'Selecione uma célula ativa no seu escopo.' using errcode='42501'; end if;
   update videira.people set cell_id=coalesce(destination,cell_id),full_name=trim(p_data->>'full_name'),phone=p_data->>'phone',category=(p_data->>'category')::videira.person_category,baptized=p_data->>'baptized',marital_status=p_data->>'marital_status',
    birth_date=case when p_data ? 'birth_date' then videira_private.parse_birth_date(p_data->>'birth_date') else birth_date end
   where id=(p_data->>'id')::uuid and active
    and (not (p_data ? 'original_cell_id') or cell_id=(p_data->>'original_cell_id')::uuid)
   returning id into target;
  end if;
  if target is not null and p_data ? 'photo_base64' then
   if length(coalesce(p_data->>'photo_base64','')) not between 8 and 700000
    or (p_data->>'photo_base64') !~ '^[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Escolha uma foto JPEG válida.';
   end if;
   photo_bytes:=decode(p_data->>'photo_base64','base64');
   if substring(photo_bytes from 1 for 3)<>decode('ffd8ff','hex') then
    raise exception 'Escolha uma foto JPEG válida.';
   end if;
   insert into videira_private.person_photos(person_id,jpeg) values(target,photo_bytes)
   on conflict(person_id) do update set jpeg=excluded.jpeg;
  end if;
 elsif p_action='cell_trainee' then
  return videira_private.set_cell_trainee((p_data->>'cell_id')::uuid,nullif(p_data->>'person_id','')::uuid);
 elsif p_action='meeting_archive' then
  return public.videira_call_archive((p_data->>'id')::uuid,coalesce((p_data->>'restore')::boolean,false));
 elsif p_action='meeting' then
  return videira.record_meeting((p_data->>'cell_id')::uuid,(p_data->>'date')::date,p_data->'attendance');
 else raise exception 'Operação inválida';
 end if;
 if target is null then raise exception 'Registro indisponível' using errcode='42501'; end if;
 return jsonb_build_object('id',target);
end $$;

commit;
