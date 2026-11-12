begin;

-- Attendance belongs to the meeting's cell, even after a person transfers.
alter table videira.attendance
 add constraint attendance_person_history_fk foreign key(person_id) references videira.people(id);
alter table videira.attendance drop constraint attendance_person_id_cell_id_fkey;

create function videira_private.check_attendance_person_cell() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(
  select 1 from videira.people
  where id=new.person_id and cell_id=new.cell_id and active
  for share
 ) then raise exception 'Participante fora da célula da chamada.' using errcode='23503'; end if;
 return new;
end $$;
revoke all on function videira_private.check_attendance_person_cell() from public,anon,authenticated;
create trigger check_attendance_person_cell
 before insert or update of person_id,cell_id on videira.attendance
 for each row execute function videira_private.check_attendance_person_cell();

create table videira_private.person_photos (
 person_id uuid primary key references videira.people(id) on delete cascade,
 jpeg bytea not null check (octet_length(jpeg) between 4 and 525000
  and substring(jpeg from 1 for 3)=decode('ffd8ff','hex'))
);
alter table videira_private.person_photos enable row level security;
revoke all on videira_private.person_photos from public,anon;
grant select,insert,update on videira_private.person_photos to authenticated;
create policy person_photos_cell_scope on videira_private.person_photos for all to authenticated
 using (exists(select 1 from videira.people p where p.id=person_id and p.active))
 with check (exists(select 1 from videira.people p where p.id=person_id and p.active));

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
