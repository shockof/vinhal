-- Use the rollback-only rls_foundation fixture.
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
do $$ declare d jsonb;begin
 d:=public.videira_portal('load')->'cell_leadership';
 if jsonb_array_length(d)<>2 then raise exception 'FAIL leadership scope';end if;
 if exists(select 1 from jsonb_array_elements(d) p where p ? 'username' or p ? 'email' or p ? 'phone') then raise exception 'FAIL excess leadership data';end if;
 if not exists(select 1 from jsonb_array_elements(d) p where p->>'display_name'='Discipulador teste') then raise exception 'FAIL discipler name';end if;
 if exists(select 1 from jsonb_array_elements(d) p where p->>'display_name'='Líder externo') then raise exception 'FAIL external name';end if;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000005',true);
do $$ begin if jsonb_array_length(public.videira_cell_leadership())<>2 then raise exception 'FAIL discipler leader names';end if;end $$;
set local role anon;
do $$ begin begin perform public.videira_cell_leadership();raise exception 'FAIL anonymous names';exception when insufficient_privilege then null;end;end $$;
reset role;
select 'PASS minimal scoped leadership names, no foreign names/contacts, no anonymous access' as hierarchy_test;
