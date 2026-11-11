-- Apply with the synthetic foundation fixtures in a rollback-only transaction.
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
do $$ declare d jsonb; revision bigint;begin
 d:=public.videira_portal('network','{"church_id":"20000000-0000-0000-0000-000000000001","name":"Master creation proof"}');if d->>'id' is null then raise exception 'FAIL Master create network';end if;
 d:=public.videira_portal('cell','{"church_id":"20000000-0000-0000-0000-000000000001","network_id":"30000000-0000-0000-0000-000000000001","name":"Master cell proof","meeting_schedule":"Quarta-feira, 19:30"}');if d->>'id' is null then raise exception 'FAIL Master create cell';end if;
 d:=public.videira_site_editor('load');revision:=(d->>'revision')::bigint;
 d:=public.videira_site_editor('save',jsonb_build_object('revision',revision,'content','{"title":"CMS test only"}'::jsonb));
 if public.videira_site_public()<>'{}'::jsonb then raise exception 'FAIL draft public';end if;
 begin perform public.videira_site_editor('save',jsonb_build_object('revision',revision,'content','{}'::jsonb));raise exception 'FAIL stale write';exception when raise_exception then if sqlerrm='FAIL stale write' then raise;end if;end;
 d:=public.videira_site_editor('publish',jsonb_build_object('revision',(d->>'revision')::bigint));
 if public.videira_site_public()->'content'->>'title'<>'CMS test only' then raise exception 'FAIL publish';end if;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
do $$ begin begin perform public.videira_site_editor('load');raise exception 'FAIL nonmaster editor';exception when insufficient_privilege then null;end;end $$;
set local role anon;
do $$ begin
 if public.videira_site_public()->'content'->>'title'<>'CMS test only' then raise exception 'FAIL anonymous publication';end if;
 begin perform public.videira_site_editor('load');raise exception 'FAIL anon draft';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS Master network/cell creation, private draft, revision lock, public snapshot, nonmaster/anonymous draft denial' as master_cms_test;
