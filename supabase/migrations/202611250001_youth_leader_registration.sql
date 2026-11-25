begin;
-- Specific delegation, independent from the read-only youth reports delegation.
create table if not exists videira_private.youth_registration_administrators (
 user_id uuid primary key references videira.profiles(id) on delete cascade
);
alter table videira_private.youth_registration_administrators enable row level security;
revoke all on videira_private.youth_registration_administrators from public,anon,authenticated;
do $$ declare target uuid; begin
 select id into target from videira.profiles where username='prvitormendes' and role='pastor' and active and registration_deleted_at is null;
 if target is null then raise exception 'Conta ativa prvitormendes não encontrada'; end if;
 insert into videira_private.youth_registration_administrators values(target) on conflict do nothing;
end $$;
create or replace function videira_private.youth_registration_network(actor uuid,network uuid,church uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from videira.profiles p
 join videira_private.youth_registration_administrators a on a.user_id=p.id
 join videira.networks n on n.organization_id=p.organization_id
 where p.id=actor and p.active and p.registration_deleted_at is null and p.role='pastor'
 and n.id=network and n.church_id=church and n.kind<>'kids'
 and lower(regexp_replace(btrim(n.name),'^rede[[:space:]]+','','i'))='jovens');
$$;
revoke all on function videira_private.youth_registration_network(uuid,uuid,uuid) from public,anon,authenticated;
create or replace function public.videira_youth_registration_scope()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me videira.profiles;
begin
 select * into me from videira.profiles where id=auth.uid() and active and registration_deleted_at is null and role='pastor';
 if me.id is null or not exists(select 1 from videira_private.youth_registration_administrators where user_id=me.id) then return null; end if;
 return jsonb_build_object('allowed_roles',jsonb_build_array('lider'),
 'networks',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'church_id',n.church_id,'name',n.name,'kind',n.kind) order by n.name),'[]') from videira.networks n where videira_private.youth_registration_network(me.id,n.id,n.church_id)),
 'churches',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'municipality',c.municipality) order by c.name),'[]') from videira.churches c where c.organization_id=me.organization_id and exists(select 1 from videira.networks n where n.church_id=c.id and videira_private.youth_registration_network(me.id,n.id,c.id))),
 'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'card_name',p.card_name,'display_name',p.display_name,'role',p.role,'church_id',p.church_id,'network_id',p.network_id,'active',p.active) order by p.display_name),'[]') from videira.profiles p where p.organization_id=me.organization_id and p.active and p.registration_deleted_at is null and p.role in ('lider','discipulador','pastor') and videira_private.youth_registration_network(me.id,p.network_id,p.church_id)));
end $$;
revoke all on function public.videira_youth_registration_scope() from public,anon;
grant execute on function public.videira_youth_registration_scope() to authenticated;
create or replace function videira_private.assert_youth_account_creation(actor uuid,data jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from videira.profiles p where p.id=actor and p.active and p.registration_deleted_at is null and p.role='master') then
  if data->>'role' is distinct from 'lider' or not videira_private.youth_registration_network(actor,nullif(data->>'network_id','')::uuid,nullif(data->>'church_id','')::uuid) then
   raise exception 'Cadastre somente líderes nas redes de jovens autorizadas' using errcode='42501';
  end if;
  if data->>'member_id' is not null and not exists(select 1 from videira.people m join videira.cells c on c.id=m.cell_id where m.id=(data->>'member_id')::uuid and c.church_id=(data->>'church_id')::uuid and c.network_id=(data->>'network_id')::uuid and m.active) then raise insufficient_privilege; end if;
 end if;
 if length(coalesce(data->>'phone',''))>40 or length(coalesce(data->>'card_name',''))>80 then raise exception 'Confira os dados de contato'; end if;
 if nullif(data->>'leadership_photo','') is not null and (length(data->>'leadership_photo')>800000 or data->>'leadership_photo' !~ '^/9j/[A-Za-z0-9+/]*={0,2}$') then raise exception 'Foto JPEG inválida'; end if;
end $$;
revoke all on function videira_private.assert_youth_account_creation(uuid,jsonb) from public,anon,authenticated;
do $migration$
declare definition text; anchor text;
begin
 definition:=pg_get_functiondef('public.videira_account_provision(uuid,uuid,jsonb,boolean)'::regprocedure);
 if strpos(definition,'videira_private.assert_youth_account_creation')=0 then
 anchor:='where id=p_actor and active and role=''master'' for share;';
 if strpos(definition,anchor)=0 then raise exception 'Revise a autorização do provisionamento'; end if;
 definition:=replace(definition,anchor,'where id=p_actor and active and registration_deleted_at is null and (role=''master'' or (role=''pastor'' and exists(select 1 from videira_private.youth_registration_administrators a where a.user_id=p_actor))) for share;');
 anchor:='target_role:=(p_data->>''role'')::videira.leadership_role;';
 if strpos(definition,anchor)=0 then raise exception 'Revise a validação da função'; end if;
 definition:=replace(definition,anchor,'perform videira_private.assert_youth_account_creation(p_actor,p_data);'||chr(10)||anchor);
 anchor:='return jsonb_build_object(''id'',p_auth_user,''username'',target_username,''role'',target_role);';
 if strpos(definition,anchor)=0 then raise exception 'Revise o resultado do provisionamento'; end if;
 definition:=replace(definition,anchor,$body$
 if actor.role<>'master' then
  insert into videira_private.profile_details(user_id,phone,contact_email)
  select id,coalesce(p_data->>'phone',''),case when email like '%@accounts.videira.invalid' then '' else coalesce(email,'') end from auth.users where id=p_auth_user
  on conflict(user_id) do update set phone=excluded.phone;
  update videira.profiles set card_name=nullif(btrim(p_data->>'card_name'),'') where id=p_auth_user;
  if nullif(p_data->>'leadership_photo','') is not null then insert into videira_private.leadership_photos(user_id,photo) values(p_auth_user,p_data->>'leadership_photo'); end if;
 end if;
 return jsonb_build_object('id',p_auth_user,'username',target_username,'role',target_role);
$body$);
 execute definition;
 end if;
end $migration$;
-- Preserve existing roles; add only the account-specific youth registration branch.
create or replace function videira_private.can_create_pastoral_cell(org uuid, church uuid, network uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from videira.networks n where n.id=network and n.organization_id=org and n.church_id=church)
 and (videira_private.kids_supervision(org,network)
 or exists(select 1 from videira.profiles p where p.id=auth.uid() and p.active and p.registration_deleted_at is null and p.organization_id=org and
 (videira_private.youth_registration_network(p.id,network,church)
 or (p.church_id=church and ((p.role='obreiro' and videira_private.worker_network_scope(p.network_id,network)) or (p.role='pastor' and p.network_id=network))))));
$$;
notify pgrst,'reload schema';
commit;
