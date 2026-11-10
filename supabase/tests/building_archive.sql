-- Runs after rls_foundation fixtures, within a rollback-only transaction.
insert into auth.users(id,email) values('90000000-0000-0000-0000-000000000008','building-test@example.invalid');
insert into videira.profiles(id,organization_id,username,display_name,role,church_id) values('90000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','test.predio','Pastor prédio teste','predio','20000000-0000-0000-0000-000000000001');
insert into videira.meetings(id,organization_id,cell_id,meeting_date,recorded_by) values
('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-01-01','90000000-0000-0000-0000-000000000006'),
('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','2026-01-01','90000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','2026-01-01','90000000-0000-0000-0000-000000000007');
insert into videira.attendance(meeting_id,cell_id,person_id,present) select '60000000-0000-0000-0000-000000000001',cell_id,id,true from videira.people where cell_id='40000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000006',true);
do $$ begin begin perform public.videira_call_archive('60000000-0000-0000-0000-000000000001');raise exception 'FAIL leader delete';exception when insufficient_privilege then null;end;end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000005',true);
do $$ begin begin perform public.videira_call_archive('60000000-0000-0000-0000-000000000001');raise exception 'FAIL discipler delete';exception when insufficient_privilege then null;end;end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
do $$ declare d jsonb;begin
 perform public.videira_portal('meeting_archive','{"id":"60000000-0000-0000-0000-000000000001"}');
 d:=public.videira_portal('load');if jsonb_array_length(d->'meetings')<>0 or jsonb_array_length(d->'attendance')<>0 or jsonb_array_length(d->'archived_meetings')<>1 then raise exception 'FAIL deleted call leaked to metrics';end if;
 begin perform public.videira_call_archive('60000000-0000-0000-0000-000000000002');raise exception 'FAIL pastor other church';exception when insufficient_privilege then null;end;
 begin perform public.videira_call_archive('60000000-0000-0000-0000-000000000003');raise exception 'FAIL cross org';exception when insufficient_privilege then null;end;
 perform public.videira_call_archive('60000000-0000-0000-0000-000000000001',true);
 if (select count(*) from videira.attendance)<>1 then raise exception 'FAIL restore attendance';end if;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
do $$ begin perform public.videira_call_archive('60000000-0000-0000-0000-000000000002');perform public.videira_call_archive('60000000-0000-0000-0000-000000000002',true);end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000008',true);
do $$ declare d jsonb;begin
 if (select count(*) from videira.cells)<>2 or (select count(*) from videira.networks)<>1 then raise exception 'FAIL building church scope';end if;
 if not exists(select 1 from videira.profiles where username='test.discipulador') or exists(select 1 from videira.profiles where username='test.obreiro') then raise exception 'FAIL building profiles scope';end if;
 perform public.videira_call_archive('60000000-0000-0000-0000-000000000001');perform public.videira_call_archive('60000000-0000-0000-0000-000000000001',true);
 begin perform public.videira_call_archive('60000000-0000-0000-0000-000000000002');raise exception 'FAIL building other church archive';exception when insufficient_privilege then null;end;
 d:=public.videira_portal('network','{"church_id":"20000000-0000-0000-0000-000000000001","name":"Building network test"}');if d->>'id' is null then raise exception 'FAIL building network creation';end if;
 begin perform public.videira_portal('network','{"church_id":"20000000-0000-0000-0000-000000000002","name":"Blocked"}');raise exception 'FAIL building foreign network';exception when insufficient_privilege then null;end;
 d:=public.videira_portal('cell','{"church_id":"20000000-0000-0000-0000-000000000001","network_id":"30000000-0000-0000-0000-000000000001","name":"Building cell test","leader_id":"90000000-0000-0000-0000-000000000008"}');if d->>'id' is null then raise exception 'FAIL building cell creation';end if;
 begin perform public.videira_portal('church','{"name":"Blocked","municipality":"Blocked"}');raise exception 'FAIL building church creation';exception when insufficient_privilege then null;end;
 begin perform public.videira_portal('meeting','{"cell_id":"40000000-0000-0000-0000-000000000001","date":"2026-01-02","attendance":[]}');raise exception 'FAIL building unlinked attendance';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
do $$ begin perform public.videira_call_archive('60000000-0000-0000-0000-000000000002');perform public.videira_call_archive('60000000-0000-0000-0000-000000000002',true);end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
do $$ begin perform public.videira_call_archive('60000000-0000-0000-0000-000000000001');perform public.videira_call_archive('60000000-0000-0000-0000-000000000001',true);end $$;
reset role;
select public.videira_account_provision('90000000-0000-0000-0000-000000000001',null,'{"username":"test.building.new","display_name":"Building New","role":"predio","church_id":"20000000-0000-0000-0000-000000000001"}',true);
select 'PASS building church scope/CRUD, recoverable call archive, report exclusion, restoration, cross-scope and leader/discipler denial' as building_archive_test;
