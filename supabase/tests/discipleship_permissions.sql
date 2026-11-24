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

insert into videira.people(organization_id,cell_id,full_name) values
 ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','Pessoa fictícia C');
insert into auth.users(id,email) values ('90000000-0000-0000-0000-000000000008','videira-building-test@example.invalid'),('90000000-0000-0000-0000-000000000009','videira-kids-test@example.invalid');
insert into videira.profiles(id,organization_id,username,display_name,role,church_id) values
 ('90000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','test.building','Prédio teste','predio','20000000-0000-0000-0000-000000000001'),
 ('90000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','test.kids','Supervisora teste','supervisora_kids',null);
set local role authenticated;
do $test$
declare actor integer; expected integer; scope jsonb; rows jsonb; person uuid; item jsonb;
begin
 foreach actor in array array[1,2,3,4,5,8,9] loop
  perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-'||lpad(actor::text,12,'0'),true);
  expected:=case actor when 4 then 1 when 5 then 1 when 8 then 2 else 3 end;
  scope:=public.videira_discipleship_scope();
  rows:=public.videira_discipleship(date_trunc('month',current_date)::date);
  if jsonb_array_length(scope->'cells')<>expected or jsonb_array_length(rows)<>expected then raise exception 'FAIL scope role %',actor; end if;
  if exists(select 1 from jsonb_array_elements(scope->'cells') c where c->>'organization_id'<>'10000000-0000-0000-0000-000000000001') then raise exception 'FAIL tenant isolation'; end if;
  for item in select * from jsonb_array_elements(rows) loop
   person:=(item->>'id')::uuid;
   perform public.videira_discipleship(date_trunc('month',current_date)::date,person,'ctl',true);
   perform public.videira_discipleship_person_field(person,'is_tither','Sim');
   perform public.videira_discipleship_person_field(person,'baptized','Sim');
   perform public.videira_discipleship_person_field(person,'encounter_with_god','Sim');
   perform public.videira_discipleship(date_trunc('month',current_date)::date,person,'ctl',false);
  end loop;
 end loop;
 -- The pastor's generic management scope has not been broadened.
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
 if (select count(*) from videira.cells)<>2 then raise exception 'FAIL general RLS changed';end if;
 -- Discipler cannot write another cell, even with a supplied person ID.
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
 rows:=public.videira_discipleship(date_trunc('month',current_date)::date);
 select (r->>'id')::uuid into person from jsonb_array_elements(rows) r where r->>'celulaId'='40000000-0000-0000-0000-000000000002';
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000005',true);
 begin perform public.videira_discipleship_person_field(person,'is_tither','Sim');raise exception 'FAIL cross-cell field update';exception when insufficient_privilege then null;end;
 begin perform public.videira_discipleship(date_trunc('month',current_date)::date,person,'ctl',true);raise exception 'FAIL cross-cell course update';exception when insufficient_privilege then null;end;
 -- A worker in another church cannot write that same record.
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
 begin perform public.videira_discipleship_person_field(person,'is_tither','Sim');raise exception 'FAIL cross-church field update';exception when insufficient_privilege then null;end;
 begin perform public.videira_discipleship(date_trunc('month',current_date)::date,person,'ctl',true);raise exception 'FAIL cross-church course update';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000006',true);
 begin perform public.videira_discipleship_scope();raise exception 'FAIL leader access';exception when insufficient_privilege then null;end;
end $test$;
set local role anon;
do $$ begin
 begin perform public.videira_discipleship_scope();raise exception 'FAIL anonymous metadata';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: scoped read/write, churches, disciple links, tenant isolation and unchanged general RLS' as result;
rollback;
