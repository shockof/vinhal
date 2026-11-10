begin;
-- No real records are seeded or removed. Deleted calls remain recoverable.
alter table videira.profiles add constraint building_pastor_scope check(role<>'predio' or (church_id is not null and network_id is null));
alter table videira.meetings add column deleted_at timestamptz;
alter table videira.meetings add column deleted_by uuid references auth.users(id);
alter table videira.meetings drop constraint meetings_cell_id_meeting_date_key;
create unique index meetings_active_date on videira.meetings(cell_id,meeting_date) where deleted_at is null;
create or replace function videira_private.can_cell(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from videira.cells c join videira.profiles p on p.organization_id=c.organization_id
 where c.id=target and p.id=auth.uid() and p.active and (
 p.role in ('master','supervisor') or (p.role in ('obreiro','predio') and p.church_id=c.church_id) or
 (p.role='pastor' and p.network_id=c.network_id) or (p.role='discipulador' and c.discipler_id=p.id) or
 (p.role='lider' and c.leader_id=p.id)));
$$;
create or replace function videira_private.can_church(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from videira.profiles p join videira.churches c on c.organization_id=p.organization_id
 where p.id=auth.uid() and p.active and c.id=target and (p.role in ('master','supervisor') or p.church_id=c.id));
$$;
create or replace function videira_private.can_network(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from videira.profiles p join videira.networks n on n.organization_id=p.organization_id
 where p.id=auth.uid() and p.active and n.id=target and (p.role in ('master','supervisor') or
 (p.role in ('obreiro','predio') and p.church_id=n.church_id) or p.network_id=n.id));
$$;

create function videira_private.can_manage_calls(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from videira.cells c join videira.profiles p on p.organization_id=c.organization_id where c.id=target and p.id=auth.uid() and p.active and (p.role in ('master','supervisor') or (p.role in ('obreiro','predio') and p.church_id=c.church_id) or (p.role='pastor' and p.church_id=c.church_id and p.network_id=c.network_id)));
$$;
revoke all on function videira_private.can_manage_calls(uuid) from public,anon;
grant execute on function videira_private.can_manage_calls(uuid) to authenticated;

create function videira_private.is_building_pastor(org uuid,ch uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from videira.profiles p where p.id=auth.uid() and p.active and p.role='predio' and p.organization_id=org and p.church_id=ch); $$;
revoke all on function videira_private.is_building_pastor(uuid,uuid) from public,anon;
grant execute on function videira_private.is_building_pastor(uuid,uuid) to authenticated;
alter policy network_read on videira.networks using (videira_private.can_network(id) or videira_private.is_building_pastor(organization_id,church_id));
alter policy cell_read on videira.cells using (videira_private.can_cell(id) or videira_private.is_building_pastor(organization_id,church_id));
alter policy profile_read on videira.profiles using ((id=auth.uid() and active) or videira_private.has_org_role(organization_id,array['master','supervisor']::videira.leadership_role[]) or videira_private.is_building_pastor(organization_id,church_id));
do $$ declare t text;begin
 foreach t in array array['networks','cells'] loop
 execute format('alter policy structure_insert on videira.%I with check (videira_private.has_org_role(organization_id,array[''master'',''supervisor'']::videira.leadership_role[]) or videira_private.is_building_pastor(organization_id,church_id))',t);
 execute format('alter policy structure_update on videira.%I using (videira_private.has_org_role(organization_id,array[''master'',''supervisor'']::videira.leadership_role[]) or videira_private.is_building_pastor(organization_id,church_id)) with check (videira_private.has_org_role(organization_id,array[''master'',''supervisor'']::videira.leadership_role[]) or videira_private.is_building_pastor(organization_id,church_id))',t);
 end loop;
end $$;
alter policy meeting_read on videira.meetings using (videira_private.can_cell(cell_id) and (deleted_at is null or videira_private.can_manage_calls(cell_id)));
alter policy attendance_read on videira.attendance using (videira_private.can_cell(cell_id) and exists(select 1 from videira.meetings m where m.id=meeting_id and m.deleted_at is null));
create function public.videira_call_archive(p_id uuid,p_restore boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare m videira.meetings; c uuid;
begin
 select cell_id into c from videira.meetings where id=p_id;
 if c is null or not videira_private.can_manage_calls(c) then raise insufficient_privilege;end if;
 perform 1 from videira.cells where id=c for update;
 select * into m from videira.meetings where id=p_id for update;
 if not videira_private.can_manage_calls(c) then raise insufficient_privilege;end if;
 if p_restore then
  if m.deleted_at is null then raise exception 'Esta chamada já está ativa';end if;
  if exists(select 1 from videira.meetings where cell_id=c and meeting_date=m.meeting_date and deleted_at is null) then raise exception 'Já existe outra chamada ativa nesta data';end if;
  update videira.meetings set deleted_at=null,deleted_by=null where id=p_id;
 else
  if m.deleted_at is not null then raise exception 'Esta chamada já foi excluída';end if;
  update videira.meetings set deleted_at=now(),deleted_by=auth.uid() where id=p_id;
 end if;
 insert into videira.audit_log(organization_id,actor_id,action,entity,entity_id) values(m.organization_id,auth.uid(),case when p_restore then 'restore_call' else 'archive_call' end,'meetings',p_id::text);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.videira_call_archive(uuid,boolean) from public,anon;
grant execute on function public.videira_call_archive(uuid,boolean) to authenticated;
create or replace function public.videira_account_provision(p_actor uuid,p_auth_user uuid,p_data jsonb,p_check_only boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor videira.profiles; target_role videira.leadership_role; target_church uuid; target_network uuid; target_username text; target_name text;
begin
 select * into actor from videira.profiles where id=p_actor and active and role='master' for share;
 if actor.id is null then raise exception 'Somente o Master pode cadastrar acessos' using errcode='42501';end if;
 if coalesce(p_data->>'role','') not in ('master','supervisor','lider','discipulador','pastor','obreiro','predio') then raise exception 'Função não permitida' using errcode='42501';end if;
 target_role:=(p_data->>'role')::videira.leadership_role;
 target_username:=lower(trim(p_data->>'username'));target_name:=trim(p_data->>'display_name');
 if target_username is null or target_username !~ '^[a-z0-9][a-z0-9._-]{2,49}$' then raise exception 'Usuário: use de 3 a 50 letras minúsculas, números, ponto, hífen ou sublinhado';end if;
 if target_name is null or length(target_name) not between 1 and 180 then raise exception 'Informe um nome com até 180 caracteres';end if;
 target_church:=nullif(p_data->>'church_id','')::uuid;target_network:=nullif(p_data->>'network_id','')::uuid;
 if target_role='predio' then target_network:=null;end if;
 if target_role in ('master','supervisor') then
  -- Organization-wide roles ignore client-supplied church/network scopes.
  target_church:=null;target_network:=null;
 else
  if not exists(select 1 from videira.churches where id=target_church and organization_id=actor.organization_id) then raise exception 'Selecione uma igreja da sua organização';end if;
  if target_role in ('lider','discipulador','pastor') and target_network is null then raise exception 'Selecione a rede desta função';end if;
  if target_network is not null and not exists(select 1 from videira.networks where id=target_network and church_id=target_church and organization_id=actor.organization_id) then raise exception 'A rede precisa pertencer à igreja selecionada';end if;
 end if;
 if exists(select 1 from videira.profiles where username=target_username) then raise exception 'Nome de usuário já cadastrado' using errcode='23505';end if;
 if p_check_only then return jsonb_build_object('ok',true);end if;
 if p_auth_user is null or not exists(select 1 from auth.users where id=p_auth_user) then raise exception 'Conta de autenticação indisponível';end if;
 -- Supply the verified actor for the existing audit trigger, transaction-locally.
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 insert into videira.profiles(id,organization_id,username,display_name,role,church_id,network_id)
 values(p_auth_user,actor.organization_id,target_username,target_name,target_role,target_church,target_network);
 return jsonb_build_object('id',p_auth_user,'username',target_username,'role',target_role);
end $$;
revoke all on function public.videira_account_provision(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.videira_account_provision(uuid,uuid,jsonb,boolean) to service_role;
create or replace function public.videira_admin_account(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor videira.profiles; target videira.profiles; details videira_private.profile_details; r videira.leadership_role; ch uuid; net uuid; uname text; nm text; mail text; enabled boolean;
begin
 select * into actor from videira.profiles where id=auth.uid() and active and role='master';
 if actor.id is null then raise exception 'Somente o Master pode editar contas' using errcode='42501';end if;
 perform 1 from videira.organizations where id=actor.organization_id for update;
 if not exists(select 1 from videira.profiles where id=actor.id and active and role='master') then raise insufficient_privilege;end if;
 select * into target from videira.profiles where id=(p_data->>'id')::uuid and organization_id=actor.organization_id for update;
 if target.id is null then raise exception 'Conta indisponível' using errcode='42501';end if;
 if p_action='save' then
  if coalesce(p_data->>'role','') not in ('master','supervisor','pastor','obreiro','discipulador','lider','predio') then raise exception 'Função inválida';end if;
  r:=(p_data->>'role')::videira.leadership_role;enabled:=coalesce((p_data->>'active')::boolean,true);
  if target.id=actor.id and (r<>'master' or not enabled) then raise exception 'Você não pode desativar ou retirar o próprio acesso Master';end if;
  ch:=nullif(p_data->>'church_id','')::uuid;net:=nullif(p_data->>'network_id','')::uuid;
  if r='predio' then net:=null;end if;
  if r in ('master','supervisor') then ch:=null;net:=null;else
   if not exists(select 1 from videira.churches where id=ch and organization_id=actor.organization_id) then raise exception 'Selecione uma igreja da organização';end if;
   if r in ('pastor','discipulador','lider') and net is null then raise exception 'Selecione a rede';end if;
   if net is not null and not exists(select 1 from videira.networks where id=net and church_id=ch and organization_id=actor.organization_id) then raise exception 'Rede e igreja incompatíveis';end if;
  end if;
  if exists(select 1 from videira.cells c where c.leader_id=target.id and not(r in ('master','supervisor') or (r='predio' and ch=c.church_id) or (r='lider' and ch=c.church_id and net=c.network_id))) or exists(select 1 from videira.cells c where c.discipler_id=target.id and not(r='discipulador' and ch=c.church_id and net=c.network_id)) then raise exception 'Revise os vínculos na aba Células antes de mudar a função, igreja ou rede desta conta';end if;
  uname:=lower(trim(p_data->>'username'));nm:=trim(p_data->>'display_name');mail:=lower(trim(coalesce(p_data->>'contact_email','')));
  if uname is null or uname !~ '^[a-z0-9][a-z0-9._-]{2,49}$' or nm is null or length(nm) not between 1 and 180 then raise exception 'Confira o nome e o usuário';end if;
  if length(coalesce(p_data->>'phone',''))>40 or length(mail)>254 or (mail<>'' and mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Confira telefone e e-mail de contato';end if;
  update videira.profiles set display_name=nm,username=uname,role=r,church_id=ch,network_id=net,active=enabled where id=target.id;
  insert into videira_private.profile_details(user_id,phone,contact_email) values(target.id,trim(coalesce(p_data->>'phone','')),mail)
  on conflict(user_id) do update set phone=excluded.phone,contact_email=excluded.contact_email,updated_at=now();
 elsif p_action not in ('get','password_check') then raise exception 'Operação inválida';end if;
 if p_action='password_check' and target.id=actor.id then raise exception 'Use Meu perfil para alterar sua própria senha';end if;
 select * into target from videira.profiles where id=target.id;
 select * into details from videira_private.profile_details where user_id=target.id;
 if details.user_id is null then select case when email like '%@accounts.videira.invalid' then '' else coalesce(email,'') end into mail from auth.users where id=target.id;else mail:=details.contact_email;end if;
 return jsonb_build_object('id',target.id,'display_name',target.display_name,'username',target.username,'role',target.role,'church_id',target.church_id,'network_id',target.network_id,'active',target.active,'phone',coalesce(details.phone,''),'contact_email',coalesce(mail,''));
end $$;
revoke all on function public.videira_admin_account(text,jsonb) from public,anon;
grant execute on function public.videira_admin_account(text,jsonb) to authenticated;
create or replace function videira_private.validate_cell_links() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.organization_id<>old.organization_id) then raise exception 'Identidade da célula não pode ser alterada'; end if;
 if new.leader_id is not null and not exists(select 1 from videira.profiles p where p.id=new.leader_id and p.active and p.organization_id=new.organization_id and (p.role in ('master','supervisor') or (p.role='predio' and p.church_id=new.church_id) or (p.role='lider' and p.church_id=new.church_id and p.network_id=new.network_id))) then raise exception 'Selecione um líder da mesma igreja/rede ou um Master/Pastor Supervisor ativo da organização'; end if;
 if new.discipler_id is not null and not exists(select 1 from videira.profiles p where p.id=new.discipler_id and p.active and p.role='discipulador' and p.organization_id=new.organization_id and p.church_id=new.church_id and p.network_id=new.network_id) then raise exception 'Discipulador deve pertencer à mesma igreja e rede'; end if;
 return new;
end $$;
create or replace function videira.record_meeting(p_cell_id uuid,p_date date,p_attendance jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c videira.cells; meeting_uuid uuid; payload_size integer; expected_size integer; converted integer;
begin
 if auth.uid() is null or not videira_private.can_cell(p_cell_id) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if exists(select 1 from videira.profiles where id=auth.uid() and role in ('master','supervisor','predio')) and not exists(select 1 from videira.cells where id=p_cell_id and leader_id=auth.uid()) then raise exception 'Para registrar a chamada, vincule esta conta como líder da célula' using errcode='42501';end if;
 select * into c from videira.cells where id=p_cell_id and active for update;
 if not found then raise exception 'Célula indisponível'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Maceio')::date then raise exception 'Data do encontro inválida'; end if;
 if exists(select 1 from videira.meetings where cell_id=p_cell_id and deleted_at is null and meeting_date>=p_date) then raise exception 'Registre os encontros em ordem, sem repetir a data'; end if;
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
  where m.id in(select recent.id from videira.meetings recent where recent.cell_id=c.id and recent.deleted_at is null order by recent.meeting_date desc limit 3) and a.present)=3;
 get diagnostics converted=row_count;
 return jsonb_build_object('meeting_id',meeting_uuid,'converted',converted,'present',(select count(*) from jsonb_to_recordset(p_attendance) as x(person_id uuid,present boolean) where x.present));
end $$;
revoke all on function videira_private.validate_cell_links() from public,anon,authenticated;
revoke all on function videira.record_meeting(uuid,date,jsonb) from public,anon;
grant execute on function videira.record_meeting(uuid,date,jsonb) to authenticated;
create or replace function public.videira_portal(p_action text,p_data jsonb default '{}') returns jsonb
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
 elsif p_action='person' then
  if p_data->>'id' is null then
   insert into videira.people(organization_id,cell_id,full_name,phone,category,baptized,marital_status)
   values(me.organization_id,(p_data->>'cell_id')::uuid,trim(p_data->>'full_name'),p_data->>'phone',(p_data->>'category')::videira.person_category,p_data->>'baptized',p_data->>'marital_status') returning id into target;
  else
   -- Cell association is immutable here: moving a person would detach the history.
   update videira.people set full_name=trim(p_data->>'full_name'),phone=p_data->>'phone',category=(p_data->>'category')::videira.person_category,baptized=p_data->>'baptized',marital_status=p_data->>'marital_status'
   where id=(p_data->>'id')::uuid returning id into target;
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
revoke all on function public.videira_portal(text,jsonb) from public,anon;
grant execute on function public.videira_portal(text,jsonb) to authenticated;

commit;
