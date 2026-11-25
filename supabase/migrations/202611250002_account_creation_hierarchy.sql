begin;
create table if not exists videira_private.account_creation_records(
 profile_id uuid primary key references videira.profiles(id) on delete cascade,
 created_by uuid not null references videira.profiles(id),
 cell_id uuid references videira.cells(id),
 created_at timestamptz not null default now()
);
alter table videira_private.account_creation_records add column if not exists cell_id uuid references videira.cells(id);
alter table videira_private.account_creation_records add column if not exists created_at timestamptz not null default now();
alter table videira_private.account_creation_records enable row level security;
revoke all on videira_private.account_creation_records from public,anon,authenticated;
create or replace function videira_private.account_creation_roles(actor uuid)
returns text[] language sql stable security definer set search_path='' as $$
 select case p.role
 when 'master' then array['lider','master','supervisor','supervisora_kids','discipulador','predio','pastor','obreiro']
 when 'supervisor' then array['lider','discipulador','pastor','obreiro','predio']
 when 'pastor' then array['lider','discipulador']
 when 'predio' then array['lider']
 when 'obreiro' then array['lider']
 when 'discipulador' then array['lider']
 else array[]::text[] end
 from videira.profiles p where p.id=actor and p.active and p.registration_deleted_at is null;
$$;
revoke all on function videira_private.account_creation_roles(uuid) from public,anon,authenticated;
create or replace function videira_private.can_create_account(actor uuid,target_role text,church uuid,network uuid,cell uuid default null)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare me videira.profiles;
begin
 select * into me from videira.profiles where id=actor and active and registration_deleted_at is null;
 if not found or target_role is null or not(target_role=any(videira_private.account_creation_roles(actor))) then return false;end if;
 if me.role='master' then return true;end if;
 if not exists(select 1 from videira.churches c where c.id=church and c.organization_id=me.organization_id) then return false;end if;
 if me.role='supervisor' and (target_role='predio' or (target_role='obreiro' and network is null)) then return true;end if;
 if not exists(select 1 from videira.networks n where n.id=network and n.church_id=church and n.organization_id=me.organization_id) then return false;end if;
 if me.role='supervisor' then return true;
 elsif me.role='pastor' then
  if exists(select 1 from videira_private.youth_registration_administrators a where a.user_id=me.id) then
   return videira_private.youth_registration_network(me.id,network,church);
  end if;
  return church=me.church_id and network=me.network_id;
 elsif me.role in ('predio','obreiro') then return church=me.church_id;
 elsif me.role='discipulador' then
  return exists(select 1 from videira.cells c where c.id=cell and c.active and c.organization_id=me.organization_id and c.discipler_id=me.id and c.church_id=church and c.network_id=network);
 end if;
 return false;
end $$;
revoke all on function videira_private.can_create_account(uuid,text,uuid,uuid,uuid) from public,anon,authenticated;
create or replace function public.videira_account_creation_scope()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me videira.profiles;
begin
 select * into me from videira.profiles where id=auth.uid() and active and registration_deleted_at is null;
 if not found or cardinality(videira_private.account_creation_roles(me.id))=0 then return null;end if;
 return (
 with nets as materialized (
 select n.* from videira.networks n where n.organization_id=me.organization_id and videira_private.can_create_account(me.id,'lider',n.church_id,n.id,(select c.id from videira.cells c where c.active and c.discipler_id=me.id and c.network_id=n.id and c.church_id=n.church_id order by c.id limit 1))
 ), scoped_cells as materialized (
 select c.* from videira.cells c join nets n on n.id=c.network_id where c.active and (me.role<>'discipulador' or c.discipler_id=me.id)
 )
 select jsonb_build_object(
 'allowed_roles',to_jsonb(videira_private.account_creation_roles(me.id)),
 'requires_cell',me.role='discipulador',
 'churches',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'municipality',c.municipality) order by c.name),'[]') from videira.churches c where c.organization_id=me.organization_id and (me.role in ('master','supervisor') or exists(select 1 from nets n where n.church_id=c.id))),
 'networks',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'church_id',n.church_id,'name',n.name,'kind',n.kind) order by n.name),'[]') from nets n),
 'cells',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'church_id',c.church_id,'network_id',c.network_id,'name',c.name) order by c.name),'[]') from scoped_cells c where me.role='discipulador'),
 'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'card_name',p.card_name,'display_name',p.display_name,'role',p.role,'church_id',p.church_id,'network_id',p.network_id,'active',p.active) order by p.display_name),'[]') from videira.profiles p where p.organization_id=me.organization_id and p.active and p.registration_deleted_at is null and
 case when me.role='master' then true
 when me.role='supervisor' then p.role in ('lider','discipulador','pastor','obreiro','predio')
 when me.role='discipulador' then exists(select 1 from scoped_cells c where p.id in(c.leader_id,c.discipler_id)) or exists(select 1 from videira_private.account_creation_records r join scoped_cells c on c.id=r.cell_id where r.profile_id=p.id and r.created_by=me.id and p.role='lider' and p.network_id=c.network_id and p.church_id=c.church_id)
 else p.role in ('lider','discipulador','pastor','obreiro','predio') and (exists(select 1 from nets n where n.id=p.network_id and n.church_id=p.church_id) or (me.role in ('predio','obreiro') and p.church_id=me.church_id and p.network_id is null)) end)
 )
 );
end $$;
revoke all on function public.videira_account_creation_scope() from public,anon;
grant execute on function public.videira_account_creation_scope() to authenticated;
create or replace function videira_private.assert_account_creation(actor uuid,data jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare me videira.profiles; target_cell uuid:=nullif(data->>'creation_cell_id','')::uuid;
begin
 select * into me from videira.profiles where id=actor and active and registration_deleted_at is null;
 if me.id is null then raise insufficient_privilege;end if;
 if me.role='discipulador' then perform 1 from videira.cells where id=target_cell for share;end if;
 if not videira_private.can_create_account(actor,data->>'role',nullif(data->>'church_id','')::uuid,nullif(data->>'network_id','')::uuid,target_cell) then
  raise exception 'Função, igreja, rede ou célula fora da sua permissão de cadastro' using errcode='42501';
 end if;
 if me.role<>'master' and data->>'member_id' is not null and not exists(
 select 1 from videira.people m join videira.cells c on c.id=m.cell_id where m.id=(data->>'member_id')::uuid and m.active and m.organization_id=me.organization_id and c.church_id=(data->>'church_id')::uuid and c.network_id=(data->>'network_id')::uuid and (me.role<>'discipulador' or c.id=target_cell)
 ) then raise insufficient_privilege;end if;
 if length(coalesce(data->>'phone',''))>40 or length(coalesce(data->>'card_name',''))>80 then raise exception 'Confira os dados de contato';end if;
 if nullif(data->>'leadership_photo','') is not null and (length(data->>'leadership_photo')>800000 or data->>'leadership_photo' !~ '^/9j/[A-Za-z0-9+/]*={0,2}$') then raise exception 'Foto JPEG inválida';end if;
end $$;
revoke all on function videira_private.assert_account_creation(uuid,jsonb) from public,anon,authenticated;
do $migration$
declare definition text; anchor text;
begin
 definition:=pg_get_functiondef('public.videira_account_provision(uuid,uuid,jsonb,boolean)'::regprocedure);
 if strpos(definition,'videira_private.assert_account_creation(p_actor,p_data)')=0 then
 anchor:='where id=p_actor and active and registration_deleted_at is null and (role=''master'' or (role=''pastor'' and exists(select 1 from videira_private.youth_registration_administrators a where a.user_id=p_actor))) for share;';
 if strpos(definition,anchor)=0 then raise exception 'Revise a autorização atual do provisionamento';end if;
 definition:=replace(definition,anchor,'where id=p_actor and active and registration_deleted_at is null and role in (''master'',''supervisor'',''pastor'',''predio'',''obreiro'',''discipulador'') for share;');
 anchor:='perform videira_private.assert_youth_account_creation(p_actor,p_data);';
 if strpos(definition,anchor)=0 then raise exception 'Revise a validação atual do provisionamento';end if;
 definition:=replace(definition,anchor,'perform videira_private.assert_account_creation(p_actor,p_data);');
 anchor:='return jsonb_build_object(''id'',p_auth_user,''username'',target_username,''role'',target_role);';
 if strpos(definition,anchor)=0 then raise exception 'Revise o resultado do provisionamento';end if;
 definition:=replace(definition,anchor,$body$
 insert into videira_private.account_creation_records(profile_id,created_by,cell_id)
 values(p_auth_user,p_actor,case when actor.role='discipulador' then nullif(p_data->>'creation_cell_id','')::uuid else null end);
 return jsonb_build_object('id',p_auth_user,'username',target_username,'role',target_role);
$body$);
 execute definition;
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
