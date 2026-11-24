begin;

-- Dedicated permission: never expands the general management/RLS cell scope.
create or replace function videira_private.can_discipleship_cell(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from videira.cells c join videira.profiles p on p.organization_id=c.organization_id
  where c.id=target and p.id=auth.uid() and p.active and (
   p.role in ('master','supervisor','supervisora_kids','pastor')
   or (p.role in ('predio','obreiro') and p.church_id=c.church_id)
   or (p.role='discipulador' and c.discipler_id=p.id)
  )
 );
$$;
revoke all on function videira_private.can_discipleship_cell(uuid) from public,anon,authenticated;

-- Reuse the installed membership and linked-member rules; replace permissions only.
do $migration$
declare signature text; definition text; allowed constant text := '(''master'',''discipulador'',''pastor'',''predio'',''obreiro'',''supervisor'',''supervisora_kids'')';
begin
 foreach signature in array array[
  'public.videira_discipleship(date,uuid,text,boolean)',
  'public.videira_discipleship_person_field(uuid,text,text)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,'videira_private.can_cell(c.id)')=0
   or strpos(definition,'me.role not in (''master'',''discipulador'')')=0 then
   raise exception 'A função % mudou; revise as permissões antes de aplicar.',signature;
  end if;
  definition:=replace(definition,'me.role not in (''master'',''discipulador'',''pastor'',''predio'',''obreiro'',''supervisor'')','me.role not in '||allowed);
  definition:=replace(definition,'me.role not in (''master'',''discipulador'')','me.role not in '||allowed);
  definition:=replace(definition,'(me.role=''master'' or c.discipler_id=me.id)','true');
  definition:=replace(definition,'(me.role<>''discipulador'' or c.discipler_id=me.id)','true');
  definition:=replace(definition,'videira_private.can_cell(c.id)','videira_private.can_discipleship_cell(c.id)');
  execute definition;
 end loop;
end $migration$;

-- Metadata for this screen has its own scope; the portal bootstrap remains unchanged.
create or replace function public.videira_discipleship_scope()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me videira.profiles;
begin
 select * into me from videira.profiles where id=auth.uid() and active;
 if not found or me.role not in ('master','discipulador','pastor','predio','obreiro','supervisor','supervisora_kids') then
  raise insufficient_privilege;
 end if;
 return (
  with scoped_cells as materialized (
   select c.id,c.name,c.organization_id,c.church_id,c.network_id,c.discipler_id,c.leader_id,c.is_paused
   from videira.cells c where videira_private.can_discipleship_cell(c.id)
  )
  select jsonb_build_object(
   'editable',true,
   'cells',(select coalesce(jsonb_agg(to_jsonb(c) order by c.name,c.id),'[]'::jsonb) from scoped_cells c),
   'networks',(select coalesce(jsonb_agg(to_jsonb(n) order by n.name,n.id),'[]'::jsonb) from videira.networks n
    where n.organization_id=me.organization_id and (
     me.role in ('master','supervisor','supervisora_kids','pastor')
     or (me.role in ('predio','obreiro') and n.church_id=me.church_id)
     or exists(select 1 from scoped_cells c where c.network_id=n.id)
    )),
   'cell_leadership',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'card_name',p.card_name) order by p.display_name,p.id),'[]'::jsonb)
    from videira.profiles p where p.organization_id=me.organization_id and exists(select 1 from scoped_cells c where p.id in (c.leader_id,c.discipler_id))),
   'meetings',(select coalesce(jsonb_agg(jsonb_build_object('meeting_date',d.meeting_date) order by d.meeting_date),'[]'::jsonb)
    from (select distinct m.meeting_date from videira.meetings m join scoped_cells c on c.id=m.cell_id where m.deleted_at is null) d)
  )
 );
end $$;
revoke all on function public.videira_discipleship_scope() from public,anon;
grant execute on function public.videira_discipleship_scope() to authenticated;
notify pgrst,'reload schema';
commit;
