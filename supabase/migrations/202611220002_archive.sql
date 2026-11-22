begin;
alter table videira.people add column if not exists registration_deleted_at timestamptz;
alter table videira.profiles add column if not exists registration_deleted_at timestamptz;
create table if not exists videira_private.registration_trash (
 kind text not null check(kind in ('person','profile')), id uuid not null,
 organization_id uuid not null, name text not null, deleted_at timestamptz not null default now(),
 previous_active boolean not null, member_id uuid, member_active boolean,
 primary key(kind,id)
);
alter table videira_private.registration_trash enable row level security;
revoke all on videira_private.registration_trash from public,anon,authenticated;
create or replace function public.videira_registration_trash()
returns jsonb language plpgsql security definer set search_path='' as $$
declare me videira.profiles;
begin
 select * into me from videira.profiles where id=auth.uid() and active;
 if me.id is null or me.role<>'master' then raise insufficient_privilege; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'name',name,'deleted_at',deleted_at) order by deleted_at desc),'[]') from videira_private.registration_trash where organization_id=me.organization_id);
end $$;
create or replace function public.videira_registration_archive(p_kind text,p_id uuid,p_restore boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me videira.profiles; item videira_private.registration_trash; person videira.people; account videira.profiles; member uuid; member_active boolean;
begin
 select * into me from videira.profiles where id=auth.uid() and active;
 if me.id is null or me.role<>'master' then raise insufficient_privilege; end if;
 if p_kind is null or p_kind not in ('person','profile') or p_id is null or p_restore is null then raise exception 'Cadastro inválido'; end if;
 if p_restore then
  select * into item from videira_private.registration_trash where kind=p_kind and id=p_id and organization_id=me.organization_id for update;
  if not found then raise exception 'Cadastro indisponível para restauração'; end if;
  if p_kind='person' then
   update videira.people set active=item.previous_active,registration_deleted_at=null where id=p_id and organization_id=me.organization_id;
  else
   update videira.profiles set active=item.previous_active,registration_deleted_at=null where id=p_id and organization_id=me.organization_id;
   update videira.people set active=item.member_active,registration_deleted_at=null where id=item.member_id and organization_id=me.organization_id;
  end if;
  delete from videira_private.registration_trash where kind=p_kind and id=p_id;
 else
  if p_kind='person' then
   select * into person from videira.people where id=p_id and organization_id=me.organization_id and registration_deleted_at is null for update;
   if not found then raise exception 'Cadastro indisponível'; end if;
   if exists(select 1 from videira_private.member_leader_access where member_id=p_id) then raise exception 'Exclua este cadastro pela edição da conta de liderança'; end if;
   insert into videira_private.registration_trash(kind,id,organization_id,name,previous_active) values(p_kind,p_id,me.organization_id,person.full_name,person.active);
   update videira.people set active=false,registration_deleted_at=now() where id=p_id;
  else
   if p_id=me.id then raise exception 'Não é possível excluir sua própria conta'; end if;
   select * into account from videira.profiles where id=p_id and organization_id=me.organization_id and registration_deleted_at is null for update;
   if not found then raise exception 'Conta indisponível'; end if;
   select p.id,p.active into member,member_active from videira_private.member_leader_access l join videira.people p on p.id=l.member_id where l.profile_id=p_id and p.organization_id=me.organization_id;
   insert into videira_private.registration_trash(kind,id,organization_id,name,previous_active,member_id,member_active) values(p_kind,p_id,me.organization_id,account.display_name,account.active,member,member_active);
   update videira.profiles set active=false,registration_deleted_at=now() where id=p_id;
   update videira.people set active=false,registration_deleted_at=now() where id=member;
  end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.videira_registration_trash() from public,anon;
revoke all on function public.videira_registration_archive(text,uuid,boolean) from public,anon;
grant execute on function public.videira_registration_trash() to authenticated;
grant execute on function public.videira_registration_archive(text,uuid,boolean) to authenticated;
do $$
declare d text:=pg_get_functiondef('public.videira_portal(text,jsonb)'::regprocedure);
begin
 execute replace(d,'from videira.profiles order by display_name','from videira.profiles where registration_deleted_at is null order by display_name');
end $$;
notify pgrst,'reload schema';
commit;
