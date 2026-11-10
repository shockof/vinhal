-- Synthetic fixtures only. Run in one transaction and ROLLBACK.
set local role authenticated;
do $$ declare n int; uid uuid; result jsonb; original_role text; begin
 for n in 1..6 loop
  uid:=('90000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  select role::text into original_role from videira.profiles where id=uid;
  result:=public.videira_my_profile('get');if result->>'id'<>uid::text then raise exception 'FAIL wrong profile';end if;
  result:=public.videira_my_profile('save',jsonb_build_object('id','90000000-0000-0000-0000-000000000007','role','master','active',false,'display_name','Nome teste '||n,'phone','(00) 00000-0000','contact_email','contato-'||n||'@example.invalid'));
  if result->>'id'<>uid::text or result->>'role'<>original_role or result->>'phone'<>'(00) 00000-0000' then raise exception 'FAIL self-profile scope';end if;
  if not exists(select 1 from videira.profiles where id=uid and active and role::text=original_role) then raise exception 'FAIL privilege change';end if;
 end loop;
 begin perform public.videira_my_profile('save','{"display_name":"Teste","photo_path":"90000000-0000-0000-0000-000000000007/11111111-1111-1111-1111-111111111111.jpg"}');raise exception 'FAIL foreign photo';exception when insufficient_privilege then null;end;
 begin perform 1 from videira_private.profile_details;raise exception 'FAIL contact table exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into storage.objects(bucket_id,name) values('videira-avatars','90000000-0000-0000-0000-000000000006/11111111-1111-1111-1111-111111111111.jpg'),('videira-avatars','90000000-0000-0000-0000-000000000005/22222222-2222-2222-2222-222222222222.jpg');
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000006',true);
do $$ begin
 if (select count(*) from storage.objects where bucket_id='videira-avatars')<>1 then raise exception 'FAIL avatar isolation';end if;
 begin insert into storage.objects(bucket_id,name) values('videira-avatars','90000000-0000-0000-0000-000000000005/33333333-3333-3333-3333-333333333333.jpg');raise exception 'FAIL foreign avatar upload';exception when insufficient_privilege then null;end;
end $$;
reset role;
update videira.profiles set active=false where id='90000000-0000-0000-0000-000000000006';
set local role authenticated;
do $$ begin begin perform public.videira_my_profile('get');raise exception 'FAIL inactive profile';exception when insufficient_privilege then null;end;end $$;
set local role anon;
do $$ begin begin perform public.videira_my_profile('get');raise exception 'FAIL anonymous profile';exception when insufficient_privilege then null;end;end $$;
reset role;
select 'PASS own profile for six roles, no privilege changes/foreign edits, private contacts/photos, inactive and anonymous denied' as profile_test;
