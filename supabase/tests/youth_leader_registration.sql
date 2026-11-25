begin;
do $$
declare actor uuid; org uuid; net record; ok jsonb; denied boolean; item jsonb; scope jsonb; chosen uuid; leader uuid; bad_leader uuid;
begin
 select id,organization_id into actor,org from videira.profiles where username='prvitormendes' and active;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 scope:=public.videira_youth_registration_scope();
 if scope is null or scope->'allowed_roles'<>'["lider"]'::jsonb then raise exception 'Escopo ou funções incorretos'; end if;
 for net in select * from videira.networks where organization_id=org loop
  if videira_private.youth_registration_network(actor,net.id,net.church_id) then
   ok:=public.videira_account_provision(actor,null,jsonb_build_object('username','qa_youth_preflight_20261125','display_name','Verificação sem cadastro','role','lider','church_id',net.church_id,'network_id',net.id),true);
   if ok->>'ok'<>'true' then raise exception 'Líder não autorizado na rede correta';end if;
   if not videira_private.can_create_pastoral_cell(org,net.church_id,net.id) then raise exception 'Célula bloqueada na rede correta';end if;
  else
   denied:=false;
   begin perform public.videira_account_provision(actor,null,jsonb_build_object('username','qa_youth_preflight_20261125','display_name','Verificação sem cadastro','role','lider','church_id',net.church_id,'network_id',net.id),true);exception when insufficient_privilege then denied:=true;end;
   if not denied then raise exception 'Rede fora do escopo foi aceita';end if;
  end if;
 end loop;
 select network_id into chosen from videira.profiles where id=actor;
 for item in select to_jsonb(x) from unnest(array['master','supervisor','predio','pastor','obreiro','supervisora_kids']) x loop
  denied:=false;
  begin perform public.videira_account_provision(actor,null,jsonb_build_object('username','qa_youth_preflight_20261125','display_name','Verificação sem cadastro','role',item#>>'{}','church_id',(select church_id from videira.networks where id=chosen),'network_id',chosen),true);exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Elevação de função aceita';end if;
 end loop;
 if jsonb_array_length(scope->'profiles')<>(select count(*) from videira.profiles p where p.active and p.registration_deleted_at is null and p.role in ('lider','discipulador','pastor') and videira_private.youth_registration_network(actor,p.network_id,p.church_id)) then raise exception 'Lista incompleta de liderança';end if;
 -- Every other active account must receive no new delegation.
 for net in select id from videira.profiles where id<>actor and active and registration_deleted_at is null loop
  perform set_config('request.jwt.claim.sub',net.id::text,true);
  if public.videira_youth_registration_scope() is not null then raise exception 'Delegação vazou para outro cadastro';end if;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 if public.videira_youth_registration_scope() is not null then raise exception 'Escopo anônimo';end if;
end $$;
-- Check the actual authenticated, RLS-protected cell creation and link validation.
select set_config('request.jwt.claim.sub',(select id::text from videira.profiles where username='prvitormendes'),true);
set local role authenticated;
select public.videira_portal('cell',jsonb_build_object('name','QA SOMENTE TRANSACAO ROLLBACK','church_id',(select church_id from videira.profiles where id=auth.uid()),'network_id',(select network_id from videira.profiles where id=auth.uid()),'leader_id',(select p->>'id' from jsonb_array_elements(public.videira_youth_registration_scope()->'profiles') p where p->>'role'='lider' and p->>'network_id'=(select network_id::text from videira.profiles where id=auth.uid()) limit 1),'meeting_schedule','Quinta-feira, 20:00')) as cell_creation_rollback;
reset role;
rollback;
select 'PASS: Vitor cria líderes de Jovens, todas as redes autorizadas, lista completa, demais contas inalteradas; célula de teste desfeita.' as resultado;
