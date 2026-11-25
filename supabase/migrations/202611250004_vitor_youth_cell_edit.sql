begin;
create or replace function videira_private.can_edit_youth_cell(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from videira.cells c join videira.profiles p on p.id=auth.uid() and p.organization_id=c.organization_id where c.id=target and c.active and p.active and p.registration_deleted_at is null and videira_private.youth_registration_network(p.id,c.network_id,c.church_id));
$$;
revoke all on function videira_private.can_edit_youth_cell(uuid) from public,anon;
grant execute on function videira_private.can_edit_youth_cell(uuid) to authenticated;
create or replace function videira_private.can_edit_youth_cell_scope(org uuid,church uuid,network uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from videira.profiles p where p.id=auth.uid() and p.active and p.registration_deleted_at is null and p.organization_id=org and videira_private.youth_registration_network(p.id,network,church));
$$;
revoke all on function videira_private.can_edit_youth_cell_scope(uuid,uuid,uuid) from public,anon;
grant execute on function videira_private.can_edit_youth_cell_scope(uuid,uuid,uuid) to authenticated;
create policy youth_administrator_cell_update on videira.cells for update to authenticated
using (videira_private.can_edit_youth_cell(id)) with check (videira_private.can_edit_youth_cell(id) and videira_private.can_edit_youth_cell_scope(organization_id,church_id,network_id));
do $migration$
declare definition text; anchor text:='if me.role not in (''pastor'',''obreiro'',''supervisora_kids'') or p_data->>''id'' is not null then';
begin
 definition:=pg_get_functiondef('public.videira_portal(text,jsonb)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Revise a autorização de edição da célula';end if;
 execute replace(definition,anchor,'if (me.role not in (''pastor'',''obreiro'',''supervisora_kids'') or p_data->>''id'' is not null) and not videira_private.can_edit_youth_cell(nullif(p_data->>''id'','''')::uuid) then');
end $migration$;
notify pgrst,'reload schema';
commit;
