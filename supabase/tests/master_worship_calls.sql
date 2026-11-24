begin;
do $$
declare actor record; c record; expected boolean; actual boolean; checked integer:=0;
begin
 for actor in select * from videira.profiles where active and registration_deleted_at is null loop
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  for c in select * from videira.cells loop
   expected:=c.active and c.organization_id=actor.organization_id and (actor.role='master' or c.discipler_id=actor.id or (c.leader_id=actor.id and not exists(select 1 from videira.profiles d where d.organization_id=c.organization_id and d.church_id=c.church_id and d.role='discipulador' and d.active and d.registration_deleted_at is null)));
   actual:=videira_private.can_record_worship(c.id);
   if actual is distinct from coalesce(expected,false) then raise exception 'Unexpected cell permission for role %',actor.role;end if;
   checked:=checked+1;
  end loop;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from videira.cells cell_row where videira_private.can_record_worship(cell_row.id)) then raise exception 'Anonymous access allowed';end if;
 raise notice 'Checked % account/cell combinations',checked;
end $$;
select 'Master scope and existing role boundaries verified; no changes retained.' as result;
rollback;
