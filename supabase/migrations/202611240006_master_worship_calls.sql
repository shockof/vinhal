begin;
-- Master may test and record worship attendance inside the same organization.
create or replace function videira_private.can_record_worship(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from videira.cells c join videira.profiles p on p.organization_id=c.organization_id
 where c.id=target and c.active and p.id=auth.uid() and p.active and p.registration_deleted_at is null
 and (p.role='master' or c.discipler_id=p.id or (c.leader_id=p.id and not exists(
  select 1 from videira.profiles d where d.organization_id=c.organization_id and d.church_id=c.church_id
   and d.role='discipulador' and d.active and d.registration_deleted_at is null
 ))));
$$;
revoke all on function videira_private.can_record_worship(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
