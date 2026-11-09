set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000006',true);
do $$ declare data jsonb; begin
 data:=public.videira_portal('load');
 if jsonb_array_length(data->'cells')<>1 or jsonb_array_length(data->'people')<>1 then raise exception 'FAIL portal leader scope'; end if;
 begin perform public.videira_portal('church','{"name":"Denied","municipality":"Test"}');raise exception 'FAIL leader structure write';exception when insufficient_privilege then null;end;
 begin perform public.videira_login_lookup('master',repeat('a',64));raise exception 'FAIL login directory readable';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
do $$ declare data jsonb; begin
 data:=public.videira_portal('load');
 if jsonb_array_length(data->'cells')<>3 then raise exception 'FAIL portal master scope';end if;
 perform public.videira_portal('church','{"name":"Transient test","municipality":"Fictitious"}');
end $$;
set local role anon;
do $$ begin
 begin perform public.videira_portal('load');raise exception 'FAIL anonymous portal';exception when insufficient_privilege then null;end;
 begin perform public.videira_login_lookup('master',repeat('a',64));raise exception 'FAIL anonymous lookup';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare n integer; begin
 for n in 1..10 loop
 if public.videira_login_lookup('test.master',repeat('b',64)) is null then raise exception 'FAIL early rate limit';end if;
 end loop;
 if public.videira_login_lookup('test.master',repeat('b',64)) is not null then raise exception 'FAIL rate limit missing';end if;
end $$;
select 'PASS portal roles, private login lookup and rate limiting; all synthetic records rolled back' as portal_test;
