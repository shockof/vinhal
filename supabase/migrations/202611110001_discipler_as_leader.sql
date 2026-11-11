begin;
-- Additive leadership linkage; no existing assignments are changed.
create or replace function videira_private.can_cell(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from videira.cells c join videira.profiles p on p.organization_id=c.organization_id
 where c.id=target and p.id=auth.uid() and p.active and (
 p.role in ('master','supervisor') or (p.role in ('obreiro','predio') and p.church_id=c.church_id) or
 (p.role='pastor' and p.network_id=c.network_id) or (p.role='discipulador' and (c.discipler_id=p.id or c.leader_id=p.id)) or
 (p.role='lider' and c.leader_id=p.id)));
$$;
create or replace function videira_private.validate_cell_links() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.organization_id<>old.organization_id) then raise exception 'Identidade da célula não pode ser alterada'; end if;
 if new.leader_id is not null and not exists(select 1 from videira.profiles p where p.id=new.leader_id and p.active and p.organization_id=new.organization_id and (p.role in ('master','supervisor') or (p.role='predio' and p.church_id=new.church_id) or (p.role in ('lider','discipulador') and p.church_id=new.church_id and p.network_id=new.network_id))) then raise exception 'Selecione um líder ou discipulador da mesma igreja/rede, ou um administrador autorizado'; end if;
 if new.discipler_id is not null and not exists(select 1 from videira.profiles p where p.id=new.discipler_id and p.active and p.role='discipulador' and p.organization_id=new.organization_id and p.church_id=new.church_id and p.network_id=new.network_id) then raise exception 'Discipulador deve pertencer à mesma igreja e rede'; end if;
 return new;
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

commit;
