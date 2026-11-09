begin;
-- RETURNING must also see a newly inserted structure row in the same statement.
-- Scope remains confined to the authenticated profile's own organization.
alter policy church_read on videira.churches using (videira_private.has_org_role(organization_id,array['master','supervisor']::videira.leadership_role[]) or videira_private.can_church(id));
alter policy network_read on videira.networks using (videira_private.has_org_role(organization_id,array['master','supervisor']::videira.leadership_role[]) or videira_private.can_network(id));
alter policy cell_read on videira.cells using (videira_private.has_org_role(organization_id,array['master','supervisor']::videira.leadership_role[]) or videira_private.can_cell(id));
-- Login lookup is callable only by the server. No public username/email directory.
create table videira_private.login_limits(key text primary key, window_start timestamptz not null, attempts integer not null);
alter table videira_private.login_limits enable row level security;
revoke all on videira_private.login_limits from public,anon,authenticated;
create function public.videira_login_lookup(p_username text,p_ip_hash text) returns text
language plpgsql security definer set search_path='' as $$
declare k text; n integer; result text;
begin
 if p_username !~ '^[a-z0-9][a-z0-9._-]{2,49}$' or length(p_ip_hash)<>64 then return null; end if;
 foreach k in array array['user:'||p_username,'ip:'||p_ip_hash] loop
  insert into videira_private.login_limits values(k,now(),1)
  on conflict(key) do update set
   attempts=case when videira_private.login_limits.window_start<now()-interval '15 minutes' then 1 else videira_private.login_limits.attempts+1 end,
   window_start=case when videira_private.login_limits.window_start<now()-interval '15 minutes' then now() else videira_private.login_limits.window_start end
  returning attempts into n;
  if n>(case when k like 'user:%' then 10 else 30 end) then return null; end if;
 end loop;
 select u.email into result from videira.profiles p join auth.users u on u.id=p.id where p.username=p_username and p.active;
 return result;
end $$;
revoke all on function public.videira_login_lookup(text,text) from public,anon,authenticated;
grant execute on function public.videira_login_lookup(text,text) to service_role;

-- Invoker rights: every read and write is still checked by the existing RLS.
create function public.videira_portal(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare me videira.profiles; result jsonb; target uuid;
begin
 select * into me from videira.profiles where id=auth.uid() and active;
 if me.id is null then raise exception 'Acesso indisponível' using errcode='42501'; end if;
 if p_action='load' then
  return jsonb_build_object('profile',to_jsonb(me),
   'churches',coalesce((select jsonb_agg(t) from (select * from videira.churches order by name)t),'[]'),
   'networks',coalesce((select jsonb_agg(t) from (select * from videira.networks order by name)t),'[]'),
   'cells',coalesce((select jsonb_agg(t) from (select * from videira.cells where active order by name)t),'[]'),
   'people',coalesce((select jsonb_agg(t) from (select * from videira.people where active order by full_name)t),'[]'),
   'profiles',coalesce((select jsonb_agg(t) from (select id,username,display_name,role,church_id,network_id,active from videira.profiles order by display_name)t),'[]'),
   'meetings',coalesce((select jsonb_agg(t) from (select * from videira.meetings order by meeting_date)t),'[]'),
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
  if me.role not in ('master','supervisor') then raise insufficient_privilege; end if;
  if p_data->>'id' is null then
   insert into videira.networks(organization_id,church_id,name,kind) values(me.organization_id,(p_data->>'church_id')::uuid,trim(p_data->>'name'),coalesce(p_data->>'kind','regular')) returning id into target;
  else
   update videira.networks set name=trim(p_data->>'name'),kind=p_data->>'kind' where id=(p_data->>'id')::uuid returning id into target;
  end if;
 elsif p_action='cell' then
  if me.role not in ('master','supervisor') then raise insufficient_privilege; end if;
  if p_data->>'id' is null then
   insert into videira.cells(organization_id,church_id,network_id,name,meeting_schedule,private_address,latitude,longitude,leader_id,discipler_id)
   values(me.organization_id,(p_data->>'church_id')::uuid,(p_data->>'network_id')::uuid,trim(p_data->>'name'),p_data->>'meeting_schedule',p_data->>'private_address',nullif(p_data->>'latitude','')::float8,nullif(p_data->>'longitude','')::float8,nullif(p_data->>'leader_id','')::uuid,nullif(p_data->>'discipler_id','')::uuid) returning id into target;
  else
   update videira.cells set name=trim(p_data->>'name'),meeting_schedule=p_data->>'meeting_schedule',private_address=p_data->>'private_address',latitude=nullif(p_data->>'latitude','')::float8,longitude=nullif(p_data->>'longitude','')::float8,leader_id=nullif(p_data->>'leader_id','')::uuid,discipler_id=nullif(p_data->>'discipler_id','')::uuid
   where id=(p_data->>'id')::uuid returning id into target;
  end if;
 elsif p_action='person' then
  if p_data->>'id' is null then
   insert into videira.people(organization_id,cell_id,full_name,phone,category,baptized,marital_status)
   values(me.organization_id,(p_data->>'cell_id')::uuid,trim(p_data->>'full_name'),p_data->>'phone',(p_data->>'category')::videira.person_category,p_data->>'baptized',p_data->>'marital_status') returning id into target;
  else
   -- Cell association is immutable here: moving a person would detach the history.
   update videira.people set full_name=trim(p_data->>'full_name'),phone=p_data->>'phone',category=(p_data->>'category')::videira.person_category,baptized=p_data->>'baptized',marital_status=p_data->>'marital_status'
   where id=(p_data->>'id')::uuid returning id into target;
  end if;
 elsif p_action='meeting' then
  return videira.record_meeting((p_data->>'cell_id')::uuid,(p_data->>'date')::date,p_data->'attendance');
 else raise exception 'Operação inválida';
 end if;
 if target is null then raise exception 'Registro indisponível' using errcode='42501'; end if;
 return jsonb_build_object('id',target);
end $$;
revoke all on function public.videira_portal(text,jsonb) from public,anon;
grant execute on function public.videira_portal(text,jsonb) to authenticated;
commit;
