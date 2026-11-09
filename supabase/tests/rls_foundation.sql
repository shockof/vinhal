-- Run after foundation inside the SAME transaction, then ROLLBACK.
-- Reserved synthetic identities have no password and cannot sign in.
insert into auth.users(id,email) select
 ('90000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'videira-rls-test-'||n||'@example.invalid' from generate_series(1,7) n;
insert into videira.organizations(id,name) values
 ('10000000-0000-0000-0000-000000000001','Organização de teste A'),
 ('10000000-0000-0000-0000-000000000002','Organização de teste B');
insert into videira.churches(id,organization_id,name,municipality) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Centro teste','Município fictício'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Norte teste','Município fictício'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Outra organização','Município fictício');
insert into videira.networks(id,organization_id,church_id,name) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Rede teste A'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Rede teste B'),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','Rede externa');
insert into videira.profiles(id,organization_id,username,display_name,role,church_id,network_id) values
 ('90000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','test.master','Master teste','master',null,null),
 ('90000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','test.supervisor','Supervisor teste','supervisor',null,null),
 ('90000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','test.pastor','Pastor teste','pastor','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
 ('90000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','test.obreiro','Obreiro teste','obreiro','20000000-0000-0000-0000-000000000002',null),
 ('90000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','test.discipulador','Discipulador teste','discipulador','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
 ('90000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','test.lider','Líder teste','lider','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
 ('90000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000002','test.externo','Líder externo','lider','20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003');
insert into videira.cells(id,organization_id,church_id,network_id,name,leader_id,discipler_id) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Célula A','90000000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000005'),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Célula B',null,null),
 ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Célula C',null,null),
 ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','Célula externa','90000000-0000-0000-0000-000000000007',null);
insert into videira.people(organization_id,cell_id,full_name) values
 ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Pessoa fictícia A'),
 ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','Pessoa fictícia B'),
 ('10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','Pessoa fictícia externa');
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000006',true);
do $$ begin
 if (select count(*) from videira.cells)<>1 or (select count(*) from videira.people)<>1 then raise exception 'FAIL leader scope'; end if;
 if (select count(*) from videira.profiles)<>1 then raise exception 'FAIL profiles scope'; end if;
 begin update videira.profiles set role='master' where id=auth.uid(); raise exception 'FAIL self promotion allowed'; exception when insufficient_privilege then null; end;
 begin insert into videira.people(organization_id,cell_id,full_name) values('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','Blocked'); raise exception 'FAIL cross-cell insert'; exception when insufficient_privilege then null; end;
 begin insert into videira.meetings(organization_id,cell_id,meeting_date,recorded_by) values('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',current_date,auth.uid()); raise exception 'FAIL direct meeting write'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000005',true);
do $$ begin if (select count(*) from videira.cells)<>1 then raise exception 'FAIL discipler scope'; end if; end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
do $$ begin if (select count(*) from videira.cells)<>1 then raise exception 'FAIL worker scope'; end if; end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
do $$ begin if (select count(*) from videira.cells)<>2 then raise exception 'FAIL pastor scope'; end if; end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
do $$ begin if (select count(*) from videira.cells)<>3 or (select count(*) from videira.people)<>2 then raise exception 'FAIL supervisor or tenant isolation'; end if; end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
do $$ begin if (select count(*) from videira.cells)<>3 then raise exception 'FAIL master or tenant isolation'; end if; end $$;
set local role anon;
do $$ begin
 begin perform 1 from videira.people; raise exception 'FAIL anonymous access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from pg_tables where schemaname='videira' and rowsecurity)<>10 then raise exception 'FAIL RLS not enabled on all tables'; end if;
 if exists(select 1 from storage.buckets where id='videira-private' and public) then raise exception 'FAIL public storage'; end if;
end $$;
select 'PASS: six roles, tenant isolation, no anonymous access, no self-promotion, private files' as security_test;
