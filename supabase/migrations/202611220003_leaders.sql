begin;
create or replace function videira_private.ensure_regular_leader_member(p_profile uuid)
returns void language plpgsql security definer set search_path='' as $$
declare account videira.profiles; destination uuid; member uuid; matches integer; guard text;
begin
 select * into account from videira.profiles where id=p_profile and active and registration_deleted_at is null for update;
 if not found or exists(select 1 from videira_private.member_leader_access where profile_id=p_profile) then return; end if;
 select c.id into destination from videira.cells c join videira.networks n on n.id=c.network_id and n.kind='regular'
 where c.organization_id=account.organization_id and c.leader_id=p_profile and c.active and not c.is_paused
 order by (select count(*) from videira.people p where p.cell_id=c.id and p.active and p.category='Membro'),lower(c.name),c.id limit 1;
 if destination is null then return; end if;
 select count(*),min(p.id::text)::uuid into matches,member from videira.people p join videira.cells c on c.id=p.cell_id join videira.networks n on n.id=c.network_id and n.kind='regular'
 where p.organization_id=account.organization_id and c.leader_id=p_profile and p.active and p.category='Membro'
 and lower(btrim(p.full_name))=lower(btrim(account.display_name)) and not exists(select 1 from videira_private.member_leader_access l where l.member_id=p.id);
 if matches>1 then return; end if;
 guard:=current_setting('videira.regular_member_move',true);
 perform set_config('videira.regular_member_move','enrolling',true);
 if member is null then
 insert into videira.people(organization_id,cell_id,full_name,category,phone,birth_date)
 select account.organization_id,destination,account.display_name,'Membro',d.phone,d.birth_date from (select 1) x left join videira_private.profile_details d on d.user_id=p_profile returning id into member;
 end if;
 insert into videira_private.member_leader_access(member_id,profile_id) values(member,p_profile);
 perform set_config('videira.regular_member_move',coalesce(guard,''),true);
end $$;
revoke all on function videira_private.ensure_regular_leader_member(uuid) from public,anon,authenticated;
do $$ declare d text; begin
 d:=pg_get_functiondef('videira_private.reconcile_regular_leader(uuid)'::regprocedure);
 execute replace(d,'if p_profile is null then return; end if;','if p_profile is null then return; end if; perform videira_private.ensure_regular_leader_member(p_profile);');
 d:=pg_get_functiondef('public.videira_portal(text,jsonb)'::regprocedure);
 execute replace(d,'select id,username,display_name,role','select id,username,card_name,display_name,role');
end $$;
select videira_private.reconcile_regular_leader(id) from videira.profiles where active and registration_deleted_at is null;
notify pgrst,'reload schema';
commit;
