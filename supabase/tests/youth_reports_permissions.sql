begin;
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

insert into videira_private.youth_report_administrators(user_id) values ('90000000-0000-0000-0000-000000000003');
update videira.networks set name='Jovens' where id in ('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003');
insert into videira.networks(id,organization_id,church_id,name) values ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Adultos');
update videira.cells set network_id='30000000-0000-0000-0000-000000000004' where id='40000000-0000-0000-0000-000000000002';
insert into videira.people(organization_id,cell_id,full_name) values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','Pessoa fictícia C');
insert into videira_private.person_courses(person_id,course) select id,'ctl' from videira.people;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
do $$
declare scope jsonb; courses jsonb;
begin
 scope:=public.videira_youth_report_scope();courses:=public.videira_report_courses();
 if jsonb_array_length(scope->'churches')<>2 or jsonb_array_length(scope->'cells')<>2 or jsonb_array_length(scope->'people')<>2 then raise exception 'FAIL youth report scope';end if;
 if exists(select 1 from jsonb_array_elements(scope->'networks') n where n->>'name'<>'Jovens') then raise exception 'FAIL other networks leaked';end if;
 if (select count(*) from jsonb_object_keys(courses))<>2 then raise exception 'FAIL courses outside youth scope';end if;
 if (select count(*) from videira.cells)<>1 then raise exception 'FAIL generic management scope expanded';end if;
 if exists(select 1 from jsonb_array_elements(scope->'people') p where p->>'organization_id'<>'10000000-0000-0000-0000-000000000001') then raise exception 'FAIL tenant isolation';end if;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
do $$ begin if public.videira_youth_report_scope() is not null then raise exception 'FAIL unassigned account delegated';end if;end $$;
set local role anon;
do $$ begin begin perform public.videira_youth_report_scope();raise exception 'FAIL anonymous report';exception when insufficient_privilege then null;end;end $$;
reset role;
select 'PASS: youth across churches, no other networks or organizations, unchanged general access and other accounts' as result;
rollback;
