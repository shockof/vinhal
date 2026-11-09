-- Run with rls_foundation.sql fixtures inside a transaction; ROLLBACK at end.
insert into auth.users(id,email) select ('90000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'provision-test-'||n||'@example.invalid' from generate_series(8,13)n;
do $$ declare r text; n integer:=7; payload jsonb; created jsonb; begin
 foreach r in array array['lider','discipulador','pastor','obreiro','master','supervisor'] loop
  n:=n+1;
  payload:=jsonb_build_object('username','new.'||r,'display_name','Teste '||r,'role',r,'church_id','20000000-0000-0000-0000-000000000001','network_id',case when r='obreiro' then null else '30000000-0000-0000-0000-000000000001' end,'organization_id','10000000-0000-0000-0000-000000000002');
  perform public.videira_account_provision('90000000-0000-0000-0000-000000000001',null,payload,true);
  created:=public.videira_account_provision('90000000-0000-0000-0000-000000000001',('90000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,payload,false);
  if not exists(select 1 from videira.profiles where id=(created->>'id')::uuid and organization_id='10000000-0000-0000-0000-000000000001' and role::text=r and active and (r not in ('master','supervisor') or (church_id is null and network_id is null))) then raise exception 'FAIL create role %',r;end if;
  if not exists(select 1 from videira.audit_log where entity='profiles' and entity_id=created->>'id' and actor_id='90000000-0000-0000-0000-000000000001') then raise exception 'FAIL audit actor';end if;
 end loop;
 begin perform public.videira_account_provision('90000000-0000-0000-0000-000000000002',null,payload,true);raise exception 'FAIL supervisor provisioning';exception when insufficient_privilege then null;end;
 foreach r in array array['owner','admin'] loop
  begin perform public.videira_account_provision('90000000-0000-0000-0000-000000000001',null,payload||jsonb_build_object('role',r),true);raise exception 'FAIL forbidden role';exception when insufficient_privilege then null;end;
 end loop;
 begin perform public.videira_account_provision('90000000-0000-0000-0000-000000000001',null,payload||'{"role":"obreiro","username":"external.test","church_id":"20000000-0000-0000-0000-000000000003"}',true);raise exception 'FAIL external church accepted';exception when raise_exception then if sqlerrm='FAIL external church accepted' then raise;end if;end;
 begin perform public.videira_account_provision('90000000-0000-0000-0000-000000000001',null,payload||'{"role":"obreiro","username":"wrong.network","network_id":"30000000-0000-0000-0000-000000000002"}',true);raise exception 'FAIL mismatched network accepted';exception when raise_exception then if sqlerrm='FAIL mismatched network accepted' then raise;end if;end;
 begin perform public.videira_account_provision('90000000-0000-0000-0000-000000000001',null,payload||'{"username":"new.lider"}',true);raise exception 'FAIL duplicate username';exception when unique_violation then null;end;
 begin perform public.videira_account_provision('90000000-0000-0000-0000-000000000001',null,payload||'{"username":"missing.network","role":"lider","network_id":null}',true);raise exception 'FAIL missing network accepted';exception when raise_exception then if sqlerrm='FAIL missing network accepted' then raise;end if;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform public.videira_account_provision('90000000-0000-0000-0000-000000000001',null,'{}',true);raise exception 'FAIL client provisioning allowed';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ begin
 begin perform public.videira_account_provision('90000000-0000-0000-0000-000000000001',null,'{}',true);raise exception 'FAIL anonymous provisioning allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: six leadership roles, own organization, required scopes, duplicate usernames, actor audit, no client provisioning or unauthorized administration' as leadership_test;
