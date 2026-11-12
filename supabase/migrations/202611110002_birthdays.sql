begin;

alter table videira.people add column birth_date date;
alter table videira_private.profile_details add column birth_date date;

create function videira_private.parse_birth_date(value text) returns date
language plpgsql stable set search_path='' as $$
declare birthday date;
begin
 if value is null or value='' then return null; end if;
 if value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
  raise exception 'Informe uma data de nascimento válida.';
 end if;
 begin
  birthday:=value::date;
 exception when datetime_field_overflow or invalid_datetime_format then
  raise exception 'Informe uma data de nascimento válida.';
 end;
 if birthday > (now() at time zone 'America/Maceio')::date then
  raise exception 'A data de nascimento não pode estar no futuro.';
 end if;
 return birthday;
end $$;

-- Check direct writes as well as portal writes.
alter table videira.people add constraint people_birth_date_valid
 check (birth_date between date '0001-01-01' and (now() at time zone 'America/Maceio')::date);

-- Publish only day and month to the authenticated birthday view.
create function videira_private.monthly_birthdays() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me videira.profiles;
 current_month integer:=extract(month from now() at time zone 'America/Maceio');
begin
 select * into me from videira.profiles where id=auth.uid() and active;
 if me.id is null then raise insufficient_privilege; end if;

 return jsonb_build_object('month',current_month,'entries',coalesce((
  select jsonb_agg(to_jsonb(entry) order by entry.day,entry.name)
  from (
   select p.full_name as name,p.category::text as kind,c.name as group_name,
     extract(day from p.birth_date)::integer as day
   from videira.people p
   join videira.cells c on c.id=p.cell_id
   where p.organization_id=me.organization_id and p.active and c.active
     and p.category='Membro'
     and extract(month from p.birth_date)=current_month
     and videira_private.can_cell(c.id)
   union all
   select p.display_name,p.role::text,ch.name,extract(day from d.birth_date)::integer
   from videira.profiles p
   join videira_private.profile_details d on d.user_id=p.id
   left join videira.churches ch on ch.id=p.church_id
   where p.organization_id=me.organization_id and p.active
     and extract(month from d.birth_date)=current_month
     and (
       p.id=me.id
       or me.role in ('master','supervisor')
       or (me.role in ('predio','obreiro') and p.church_id=me.church_id)
       or (me.role='pastor' and p.network_id=me.network_id)
       or exists (
         select 1 from videira.cells c
         where c.organization_id=me.organization_id and c.active
           and p.id in (c.leader_id,c.discipler_id)
           and videira_private.can_cell(c.id)
       )
     )
  ) entry
 ),'[]'::jsonb));
end $$;

revoke all on function videira_private.parse_birth_date(text) from public,anon;
grant execute on function videira_private.parse_birth_date(text) to authenticated;
revoke all on function videira_private.monthly_birthdays() from public,anon;
grant execute on function videira_private.monthly_birthdays() to authenticated;

create or replace function public.videira_portal(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare me videira.profiles; result jsonb; target uuid;
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
 elsif p_action='person' then
  if p_data->>'id' is null then
   insert into videira.people(organization_id,cell_id,full_name,phone,category,baptized,marital_status,birth_date)
   values(me.organization_id,(p_data->>'cell_id')::uuid,trim(p_data->>'full_name'),p_data->>'phone',(p_data->>'category')::videira.person_category,p_data->>'baptized',p_data->>'marital_status',videira_private.parse_birth_date(p_data->>'birth_date')) returning id into target;
  else
   -- Cell association is immutable here: moving a person would detach the history.
   update videira.people set full_name=trim(p_data->>'full_name'),phone=p_data->>'phone',category=(p_data->>'category')::videira.person_category,baptized=p_data->>'baptized',marital_status=p_data->>'marital_status',
    birth_date=case when p_data ? 'birth_date' then videira_private.parse_birth_date(p_data->>'birth_date') else birth_date end
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

create or replace function public.videira_my_profile(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare me videira.profiles; detail videira_private.profile_details; mail text; new_name text; new_photo text;
begin
 select * into me from videira.profiles where id=auth.uid() and active for share;
 if me.id is null then raise exception 'Acesso indisponível' using errcode='42501';end if;
 select * into detail from videira_private.profile_details where user_id=me.id;
 if p_action='save' then
  new_name:=trim(p_data->>'display_name');mail:=lower(trim(coalesce(p_data->>'contact_email','')));
  if new_name is null or length(new_name) not between 1 and 180 then raise exception 'Informe um nome com até 180 caracteres';end if;
  if length(coalesce(p_data->>'phone',''))>40 or length(mail)>254 or (mail<>'' and mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Confira o telefone e o e-mail de contato';end if;
  new_photo:=case when p_data ? 'photo_path' then nullif(p_data->>'photo_path','') else detail.photo_path end;
  if new_photo is not null and new_photo !~ ('^'||me.id::text||'/[0-9a-f-]{36}\.jpg$') then raise exception 'Foto inválida' using errcode='42501';end if;
  update videira.profiles set display_name=new_name where id=me.id;
  insert into videira_private.profile_details(user_id,phone,contact_email,photo_path,birth_date)
  values(me.id,trim(coalesce(p_data->>'phone','')),mail,new_photo,case when p_data ? 'birth_date' then videira_private.parse_birth_date(p_data->>'birth_date') else detail.birth_date end)
  on conflict(user_id) do update set phone=excluded.phone,contact_email=excluded.contact_email,photo_path=excluded.photo_path,birth_date=case when p_data ? 'birth_date' then excluded.birth_date else profile_details.birth_date end,updated_at=now();
 elsif p_action<>'get' then raise exception 'Operação inválida';end if;
 select * into me from videira.profiles where id=auth.uid() and active;
 select * into detail from videira_private.profile_details where user_id=me.id;
 if detail.user_id is null then select case when email like '%@accounts.videira.invalid' then '' else coalesce(email,'') end into mail from auth.users where id=me.id;else mail:=detail.contact_email;end if;
 return jsonb_build_object('id',me.id,'display_name',me.display_name,'username',me.username,'role',me.role,'phone',coalesce(detail.phone,''),'contact_email',coalesce(mail,''),'birth_date',detail.birth_date,'photo_path',detail.photo_path);
end $$;

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
  if exists(select 1 from videira.cells c where c.leader_id=target.id and not(r in ('master','supervisor') or (r='predio' and ch=c.church_id) or (r in ('lider','discipulador') and ch=c.church_id and net=c.network_id))) or exists(select 1 from videira.cells c where c.discipler_id=target.id and not(r='discipulador' and ch=c.church_id and net=c.network_id)) then raise exception 'Revise os vínculos na aba Células antes de mudar a função, igreja ou rede desta conta';end if;
  uname:=lower(trim(p_data->>'username'));nm:=trim(p_data->>'display_name');mail:=lower(trim(coalesce(p_data->>'contact_email','')));
  if uname is null or uname !~ '^[a-z0-9][a-z0-9._-]{2,49}$' or nm is null or length(nm) not between 1 and 180 then raise exception 'Confira o nome e o usuário';end if;
  if length(coalesce(p_data->>'phone',''))>40 or length(mail)>254 or (mail<>'' and mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Confira telefone e e-mail de contato';end if;
  update videira.profiles set display_name=nm,username=uname,role=r,church_id=ch,network_id=net,active=enabled where id=target.id;
  insert into videira_private.profile_details(user_id,phone,contact_email,birth_date) values(target.id,trim(coalesce(p_data->>'phone','')),mail,videira_private.parse_birth_date(p_data->>'birth_date'))
  on conflict(user_id) do update set phone=excluded.phone,contact_email=excluded.contact_email,birth_date=case when p_data ? 'birth_date' then excluded.birth_date else profile_details.birth_date end,updated_at=now();
 elsif p_action not in ('get','password_check') then raise exception 'Operação inválida';end if;
 if p_action='password_check' and target.id=actor.id then raise exception 'Use Meu perfil para alterar sua própria senha';end if;
 select * into target from videira.profiles where id=target.id;
 select * into details from videira_private.profile_details where user_id=target.id;
 if details.user_id is null then select case when email like '%@accounts.videira.invalid' then '' else coalesce(email,'') end into mail from auth.users where id=target.id;else mail:=details.contact_email;end if;
 return jsonb_build_object('id',target.id,'display_name',target.display_name,'username',target.username,'role',target.role,'church_id',target.church_id,'network_id',target.network_id,'active',target.active,'birth_date',details.birth_date,'phone',coalesce(details.phone,''),'contact_email',coalesce(mail,''));
end $$;

create or replace function public.videira_account_provision(p_actor uuid,p_auth_user uuid,p_data jsonb,p_check_only boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor videira.profiles; target_role videira.leadership_role; target_church uuid; target_network uuid; target_username text; target_name text; birthday date;
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
 birthday:=videira_private.parse_birth_date(p_data->>'birth_date');
 if p_check_only then return jsonb_build_object('ok',true);end if;
 if p_auth_user is null or not exists(select 1 from auth.users where id=p_auth_user) then raise exception 'Conta de autenticação indisponível';end if;
 -- Supply the verified actor for the existing audit trigger, transaction-locally.
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 insert into videira.profiles(id,organization_id,username,display_name,role,church_id,network_id)
 values(p_auth_user,actor.organization_id,target_username,target_name,target_role,target_church,target_network);
 if birthday is not null then
  insert into videira_private.profile_details(user_id,birth_date,contact_email)
  select id,birthday,case when email like '%@accounts.videira.invalid' then '' else coalesce(email,'') end
  from auth.users where id=p_auth_user
  on conflict(user_id) do update set birth_date=excluded.birth_date;
 end if;
 return jsonb_build_object('id',p_auth_user,'username',target_username,'role',target_role);
end $$;

commit;
