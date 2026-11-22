begin;
-- Return responsible accounts only inside the caller's existing cell scope.
create or replace function public.videira_cell_leadership()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(t),'[]'::jsonb) from (
  select distinct p.id,p.display_name,p.card_name,p.username,p.role,p.church_id,p.active
  from videira.profiles p join videira.cells c
   on (p.id=c.leader_id or p.id=c.discipler_id) and p.organization_id=c.organization_id
  where c.active and p.active and p.registration_deleted_at is null
   and auth.uid() is not null and videira_private.can_cell(c.id)
 ) t;
$$;
commit;
