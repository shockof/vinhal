-- Synthetic fixtures from rls_foundation.sql; all work must be rolled back.
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
do $$ declare created uuid; result jsonb; bad jsonb; begin
 if not exists(select 1 from videira.cells where id='40000000-0000-0000-0000-000000000001' and private_address='Endereço anterior de teste' and latitude=-9 and longitude=-35 and address_details='{}') then raise exception 'FAIL migration changed existing location';end if;
 result:=public.videira_portal('cell','{"name":"CEP teste","church_id":"20000000-0000-0000-0000-000000000001","network_id":"30000000-0000-0000-0000-000000000001","private_address":"Praça da Sé, 123, São Paulo / SP, CEP 01001-000","latitude":"-23.5505","longitude":"-46.6333","address_details":{"postal_code":"01001000","street":"Praça da Sé","house_number":"123","city":"São Paulo","state":"SP","source":"cep","accuracy_m":null}}');
 created:=(result->>'id')::uuid;
 if not exists(select 1 from videira.cells where id=created and address_details->>'house_number'='123' and address_details->>'source'='cep' and latitude=-23.5505) then raise exception 'FAIL save postal address';end if;
 perform public.videira_portal('cell',jsonb_build_object('id',created,'name','Local do aparelho','latitude','-9.65','longitude','-35.7','private_address','Endereço interno','address_details','{"source":"device","accuracy_m":15,"postal_code":"57020000"}'::jsonb));
 if not exists(select 1 from videira.cells where id=created and address_details->>'source'='device' and (address_details->>'accuracy_m')::int=15) then raise exception 'FAIL save device metadata';end if;
 foreach bad in array array['{"postal_code":"123"}'::jsonb,'{"source":"invented"}'::jsonb,'{"source":"device","accuracy_m":-1}'::jsonb] loop
  begin perform public.videira_portal('cell',jsonb_build_object('id',created,'name','Invalid','latitude','-9','longitude','-35','address_details',bad));raise exception 'FAIL invalid address accepted';exception when check_violation then null;end;
 end loop;
 begin perform public.videira_portal('cell',jsonb_build_object('id',created,'name','Invalid','address_details','{"source":"cep"}'::jsonb));raise exception 'FAIL source without coordinates accepted';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000006',true);
do $$ begin
 begin perform public.videira_portal('cell','{"name":"Denied"}');raise exception 'FAIL leader structure write';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS cell address metadata, CEP/device coordinates, preserved old addresses, validation and permissions' as location_test;
