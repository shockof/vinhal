-- Requires rls_foundation.sql fixtures, all work rolled back.
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
do $$ declare result jsonb;payload jsonb;begin
 result:=public.videira_admin_account('get','{"id":"90000000-0000-0000-0000-000000000005"}');
 payload:=result||'{"display_name":"Novo nome fictício","username":"teste.editado","phone":"000","contact_email":"edit@example.invalid"}';
 result:=public.videira_admin_account('save',payload);
 if result->>'display_name'<>'Novo nome fictício' or result->>'username'<>'teste.editado' or result->>'phone'<>'000' then raise exception 'FAIL account edit';end if;
 begin perform public.videira_admin_account('get','{"id":"90000000-0000-0000-0000-000000000007"}');raise exception 'FAIL foreign account read';exception when insufficient_privilege then null;end;
 result:=public.videira_admin_account('get','{"id":"90000000-0000-0000-0000-000000000001"}');
 begin perform public.videira_admin_account('save',result||'{"active":false}');raise exception 'FAIL own Master deactivation';exception when raise_exception then if sqlerrm='FAIL own Master deactivation' then raise;end if;end;
 begin perform public.videira_admin_account('save',result||'{"role":"supervisor"}');raise exception 'FAIL own Master demotion';exception when raise_exception then if sqlerrm='FAIL own Master demotion' then raise;end if;end;
 begin perform public.videira_admin_account('password_check',result);raise exception 'FAIL own admin reset';exception when raise_exception then if sqlerrm='FAIL own admin reset' then raise;end if;end;
 result:=public.videira_admin_account('get','{"id":"90000000-0000-0000-0000-000000000006"}');
 begin perform public.videira_admin_account('save',result||'{"church_id":"20000000-0000-0000-0000-000000000002","network_id":"30000000-0000-0000-0000-000000000002"}');raise exception 'FAIL incompatible linked cell';exception when raise_exception then if sqlerrm='FAIL incompatible linked cell' then raise;end if;end;
 perform public.videira_admin_account('save',payload||'{"active":false}');
 if exists(select 1 from videira.profiles where id='90000000-0000-0000-0000-000000000005' and active) then raise exception 'FAIL deactivate target';end if;
 begin perform public.videira_admin_password_event('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000006');raise exception 'FAIL client password audit';exception when insufficient_privilege then null;end;
 perform public.videira_portal('cell','{"name":"Maps test","church_id":"20000000-0000-0000-0000-000000000001","network_id":"30000000-0000-0000-0000-000000000001","latitude":"-23.55","longitude":"-46.63","address_details":{"source":"maps","street":"Praça da Sé","maps_url":"https://www.google.com/maps?q=-23.55,-46.63"}}');
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
do $$ begin begin perform public.videira_admin_account('get','{"id":"90000000-0000-0000-0000-000000000006"}');raise exception 'FAIL Supervisor edit';exception when insufficient_privilege then null;end;end $$;
reset role;
select 'PASS Master edit/contact/deactivation, foreign accounts denied, own Master protected, linked scopes preserved and Maps metadata accepted' as admin_edit_test;
