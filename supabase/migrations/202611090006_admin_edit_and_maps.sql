begin;
create function public.videira_admin_account(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor videira.profiles; target videira.profiles; details videira_private.profile_details; r videira.leadership_role; ch uuid; net uuid; uname text; nm text; mail text; enabled boolean;
begin
 select * into actor from videira.profiles where id=auth.uid() and active and role='master';
 if actor.id is null then raise exception 'Somente o Master pode editar contas' using errcode='42501';end if;
 perform 1 from videira.organizations where id=actor.organization_id for update;
 if not exists(select 1 from videira.profiles where id=actor.id and active and role='master') then raise insufficient_privilege;end if;
 select * into target from videira.profiles where id=(p_data->>'id')::uuid and organization_id=actor.organization_id for update;
 if target.id is null then raise exception 'Conta indisponível' using errcode='42501';end if;
 if p_action='save' then
  if coalesce(p_data->>'role','') not in ('master','supervisor','pastor','obreiro','discipulador','lider') then raise exception 'Função inválida';end if;
  r:=(p_data->>'role')::videira.leadership_role;enabled:=coalesce((p_data->>'active')::boolean,true);
  if target.id=actor.id and (r<>'master' or not enabled) then raise exception 'Você não pode desativar ou retirar o próprio acesso Master';end if;
  ch:=nullif(p_data->>'church_id','')::uuid;net:=nullif(p_data->>'network_id','')::uuid;
  if r in ('master','supervisor') then ch:=null;net:=null;else
   if not exists(select 1 from videira.churches where id=ch and organization_id=actor.organization_id) then raise exception 'Selecione uma igreja da organização';end if;
   if r in ('pastor','discipulador','lider') and net is null then raise exception 'Selecione a rede';end if;
   if net is not null and not exists(select 1 from videira.networks where id=net and church_id=ch and organization_id=actor.organization_id) then raise exception 'Rede e igreja incompatíveis';end if;
  end if;
  if exists(select 1 from videira.cells c where c.leader_id=target.id and not(r in ('master','supervisor') or (r='lider' and ch=c.church_id and net=c.network_id))) or exists(select 1 from videira.cells c where c.discipler_id=target.id and not(r='discipulador' and ch=c.church_id and net=c.network_id)) then raise exception 'Revise os vínculos na aba Células antes de mudar a função, igreja ou rede desta conta';end if;
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
create function public.videira_admin_password_event(p_actor uuid,p_target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into videira.audit_log(organization_id,actor_id,action,entity,entity_id)
 select a.organization_id,a.id,'reset_password','profiles',p.id::text from videira.profiles a join videira.profiles p on p.organization_id=a.organization_id where a.id=p_actor and a.active and a.role='master' and p.id=p_target and p.id<>a.id;
 if not found then raise insufficient_privilege;end if;
end $$;
revoke all on function public.videira_admin_password_event(uuid,uuid) from public,anon,authenticated;
grant execute on function public.videira_admin_password_event(uuid,uuid) to service_role;
create function public.videira_admin_reset_limit(p_actor uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not exists(select 1 from videira.profiles where id=p_actor and active and role='master') then return false;end if;
 insert into videira_private.login_limits values('reset:'||p_actor::text,now(),1)
 on conflict(key) do update set attempts=case when videira_private.login_limits.window_start<now()-interval '15 minutes' then 1 else videira_private.login_limits.attempts+1 end,window_start=case when videira_private.login_limits.window_start<now()-interval '15 minutes' then now() else videira_private.login_limits.window_start end returning attempts into n;
 return n<=10;
end $$;
revoke all on function public.videira_admin_reset_limit(uuid) from public,anon,authenticated;
grant execute on function public.videira_admin_reset_limit(uuid) to service_role;
alter table videira.cells drop constraint cell_address_shape;
alter table videira.cells add constraint cell_address_shape check (
 jsonb_typeof(address_details)='object' and octet_length(address_details::text)<=10000
 and (nullif(address_details->>'postal_code','') is null or address_details->>'postal_code' ~ '^[0-9]{8}$')
 and coalesce(length(address_details->>'street'),0)<=180 and coalesce(length(address_details->>'house_number'),0)<=30 and coalesce(length(address_details->>'complement'),0)<=180 and coalesce(length(address_details->>'neighborhood'),0)<=100 and coalesce(length(address_details->>'city'),0)<=100
 and (nullif(address_details->>'state','') is null or address_details->>'state' ~ '^[A-Z]{2}$')
 and (address_details->>'source' is null or (address_details->>'source' in ('device','cep','manual','maps') and latitude is not null and longitude is not null))
 and (address_details->>'accuracy_m' is null or (jsonb_typeof(address_details->'accuracy_m')='number' and (address_details->>'accuracy_m')::numeric>=0))
 and coalesce(length(address_details->>'maps_url'),0)<=4096
);
commit;
