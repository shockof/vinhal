-- Synthetic fixtures only; always rollback the transaction.
update videira.site_directory_settings set organization_id='10000000-0000-0000-0000-000000000001' where slug='vinhal';
update videira.cells set latitude=-9.65,longitude=-35.7,address_details='{"street":"Rua Exemplo","house_number":"10","city":"Cidade teste","complement":"PRIVATE COMPLEMENT"}' where id='40000000-0000-0000-0000-000000000001';
update videira.cells set active=false where id='40000000-0000-0000-0000-000000000002';
set local role anon;
do $$ declare d jsonb; c jsonb;begin
 d:=public.videira_public_cells();if jsonb_array_length(d->'cells')<>2 then raise exception 'FAIL active organization scope';end if;
 select x into c from jsonb_array_elements(d->'cells') x where x->>'id'='40000000-0000-0000-0000-000000000001';
 if c->>'address' not like '%Rua Exemplo%10%' or (c->>'latitude')::numeric<>-9.65 or c->>'leader_name'<>'Líder teste' then raise exception 'FAIL public location/leader';end if;
 if d::text like '%PRIVATE COMPLEMENT%' or c ? 'phone' or c ? 'organization_id' or c ? 'people' or c ? 'attendance' or c ? 'username' then raise exception 'FAIL private field leakage';end if;
 if exists(select 1 from jsonb_array_elements(d->'cells') x where x->>'id'='40000000-0000-0000-0000-000000000004') then raise exception 'FAIL external organization';end if;
end $$;
reset role;
select 'PASS public active cells, organization isolation, approved address/coordinates/leader only, no private fields' as public_cells_test;
