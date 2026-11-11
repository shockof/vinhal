-- Run with rls_foundation fixtures in a rollback transaction.
update videira.cells set leader_id='90000000-0000-0000-0000-000000000005' where id='40000000-0000-0000-0000-000000000002';
do $$ begin
 begin update videira.cells set leader_id='90000000-0000-0000-0000-000000000005' where id='40000000-0000-0000-0000-000000000003';raise exception 'FAIL cross network';exception when raise_exception then if sqlerrm='FAIL cross network' then raise;end if;end;
 begin update videira.cells set leader_id='90000000-0000-0000-0000-000000000005' where id='40000000-0000-0000-0000-000000000004';raise exception 'FAIL external org';exception when raise_exception then if sqlerrm='FAIL external org' then raise;end if;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000005',true);
do $$ declare records jsonb; result jsonb;begin
 if (select count(*) from videira.cells)<>2 then raise exception 'FAIL combined leadership/discipleship scope';end if;
 select jsonb_agg(jsonb_build_object('person_id',id,'present',true)) into records from videira.people where cell_id='40000000-0000-0000-0000-000000000002';
 result:=public.videira_portal('meeting',jsonb_build_object('cell_id','40000000-0000-0000-0000-000000000002','date','2026-01-01','attendance',records));
 if (result->>'present')::int<>1 then raise exception 'FAIL own call';end if;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
do $$ begin
 perform public.videira_admin_account('save','{"id":"90000000-0000-0000-0000-000000000005","display_name":"Discipulador teste","username":"test.discipulador","role":"discipulador","church_id":"20000000-0000-0000-0000-000000000001","network_id":"30000000-0000-0000-0000-000000000001","active":true}');
end $$;
reset role;
update videira.profiles set active=false where id='90000000-0000-0000-0000-000000000005';
do $$ begin begin update videira.cells set leader_id='90000000-0000-0000-0000-000000000005' where id='40000000-0000-0000-0000-000000000001';raise exception 'FAIL inactive linkage';exception when raise_exception then if sqlerrm='FAIL inactive linkage' then raise;end if;end;end $$;
select 'PASS discipler leadership, existing supervision, own attendance, account editing, wrong scope/inactive denied' as discipler_leader_test;
