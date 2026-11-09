-- Use rls_foundation.sql fixtures inside a rollback transaction.
update videira.cells set leader_id='90000000-0000-0000-0000-000000000001' where id='40000000-0000-0000-0000-000000000001';
update videira.cells set leader_id='90000000-0000-0000-0000-000000000002' where id='40000000-0000-0000-0000-000000000002';
insert into auth.users(id,email) values('90000000-0000-0000-0000-000000000008','external-admin@example.invalid');
insert into videira.profiles(id,organization_id,username,display_name,role) values('90000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000002','test.external.master','External master test','master');
do $$ begin
 begin update videira.cells set leader_id='90000000-0000-0000-0000-000000000008' where id='40000000-0000-0000-0000-000000000003';raise exception 'FAIL external admin linked';exception when raise_exception then if sqlerrm='FAIL external admin linked' then raise;end if;end;
 begin update videira.cells set leader_id='90000000-0000-0000-0000-000000000006' where id='40000000-0000-0000-0000-000000000003';raise exception 'FAIL wrong network leader linked';exception when raise_exception then if sqlerrm='FAIL wrong network leader linked' then raise;end if;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
do $$ declare records jsonb; result jsonb;begin
 select jsonb_agg(jsonb_build_object('person_id',id,'present',true)) into records from videira.people where cell_id='40000000-0000-0000-0000-000000000001';
 result:=public.videira_portal('meeting',jsonb_build_object('cell_id','40000000-0000-0000-0000-000000000001','date','2026-01-01','attendance',records));
 if (result->>'present')::int<>1 then raise exception 'FAIL Master own attendance';end if;
 begin perform public.videira_portal('meeting','{"cell_id":"40000000-0000-0000-0000-000000000002","date":"2026-01-02","attendance":[]}');raise exception 'FAIL Master unlinked attendance';exception when insufficient_privilege then null;end;
 if (select count(*) from videira.cells)<>3 then raise exception 'FAIL Master oversight changed';end if;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
do $$ declare records jsonb;result jsonb;begin
 select jsonb_agg(jsonb_build_object('person_id',id,'present',true)) into records from videira.people where cell_id='40000000-0000-0000-0000-000000000002';
 result:=public.videira_portal('meeting',jsonb_build_object('cell_id','40000000-0000-0000-0000-000000000002','date','2026-01-01','attendance',records));
 if (result->>'present')::int<>1 then raise exception 'FAIL Supervisor own attendance';end if;
 begin perform public.videira_portal('meeting','{"cell_id":"40000000-0000-0000-0000-000000000001","date":"2026-01-02","attendance":[]}');raise exception 'FAIL Supervisor unlinked attendance';exception when insufficient_privilege then null;end;
 if (select count(*) from videira.cells)<>3 then raise exception 'FAIL Supervisor oversight changed';end if;
end $$;
reset role;
update videira.profiles set active=false where id='90000000-0000-0000-0000-000000000001';
do $$ begin
 begin update videira.cells set leader_id='90000000-0000-0000-0000-000000000001' where id='40000000-0000-0000-0000-000000000003';raise exception 'FAIL inactive admin linked';exception when raise_exception then if sqlerrm='FAIL inactive admin linked' then raise;end if;end;
end $$;
select 'PASS Master/Supervisor leadership and own-cell attendance, no unlinked calls, oversight preserved, inactive/foreign links denied' as admin_cell_test;
