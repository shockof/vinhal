begin;
do $$
declare actor videira.profiles; net videira.networks; target text; expected boolean; actual boolean; cell uuid; foreign_cell uuid; scope jsonb; uid uuid; made uuid; roles text[]; item jsonb; sampled text[]:=array[]::text[]; tested integer:=0; bogus text:='qa_'||replace(gen_random_uuid()::text,'-','');
begin
 -- Synthetic actor for any missing role, only inside this rolled-back transaction.
 for target in select unnest(array['predio']) loop
  if not exists(select 1 from videira.profiles where role::text=target and active and registration_deleted_at is null) then
   select * into actor from videira.profiles where username='prfelipecampos';uid:=gen_random_uuid();
   insert into auth.users(id,aud,role,email,created_at,updated_at) values(uid,'authenticated','authenticated',uid::text||'@accounts.videira.invalid',now(),now());
   insert into videira.profiles(id,organization_id,username,display_name,role,church_id,network_id) values(uid,actor.organization_id,bogus||'_actor','Teste transacional',target::videira.leadership_role,actor.church_id,null);
  end if;
 end loop;
 for actor in select * from videira.profiles where active and registration_deleted_at is null loop
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  roles:=case actor.role when 'master' then array['lider','master','supervisor','supervisora_kids','discipulador','predio','pastor','obreiro'] when 'supervisor' then array['lider','discipulador','pastor','obreiro','predio'] when 'pastor' then array['lider','discipulador'] when 'obreiro' then array['lider'] when 'predio' then array['lider'] when 'discipulador' then array['lider'] else array[]::text[] end;
  scope:=public.videira_account_creation_scope();
  if cardinality(roles)=0 then
   if scope is not null then raise exception 'Função sem cadastro recebeu permissão';end if;
  elsif scope->'allowed_roles' is distinct from to_jsonb(roles) then raise exception 'Lista de funções incorreta para %',actor.role;end if;
  for net in select * from videira.networks where organization_id=actor.organization_id loop
   select c.id into cell from videira.cells c where c.active and c.discipler_id=actor.id and c.network_id=net.id and c.church_id=net.church_id limit 1;
   for target in select unnest(array['lider','discipulador','pastor','obreiro','predio','master','supervisor','supervisora_kids']) loop
    expected:=target=any(roles) and case actor.role
     when 'master' then true when 'supervisor' then true
     when 'pastor' then case when actor.username='prvitormendes' then net.kind<>'kids' and lower(regexp_replace(btrim(net.name),'^rede[[:space:]]+','','i'))='jovens' else actor.church_id=net.church_id and actor.network_id=net.id end
     when 'predio' then actor.church_id=net.church_id when 'obreiro' then actor.church_id=net.church_id
     when 'discipulador' then cell is not null else false end;
    actual:=videira_private.can_create_account(actor.id,target,net.church_id,net.id,cell);
    if actual is distinct from coalesce(expected,false) then raise exception 'Escopo incorreto: % / % / %',actor.username,target,net.name;end if;
    tested:=tested+1;
   end loop;
  end loop;
  if actor.role='discipulador' then
   for item in select * from jsonb_array_elements(scope->'cells') loop
    if not exists(select 1 from videira.cells c where c.id=(item->>'id')::uuid and c.discipler_id=actor.id and c.active) then raise exception 'Célula de outro discipulado';end if;
   end loop;
   select c.id into foreign_cell from videira.cells c where c.discipler_id is distinct from actor.id and c.active and c.organization_id=actor.organization_id limit 1;
   if videira_private.can_create_account(actor.id,'lider',actor.church_id,actor.network_id,foreign_cell) or videira_private.can_create_account(actor.id,'lider',actor.church_id,actor.network_id,null) then raise exception 'Discipulador sem célula própria foi autorizado';end if;
  end if;
  -- Actual provisioning: create one fully populated profile per actor role, then roll it all back.
  if cardinality(roles)>0 and not(actor.role::text=any(sampled)) then
   select c.id into cell from videira.cells c where c.active and c.discipler_id=actor.id limit 1;
   if actor.role<>'discipulador' or cell is not null then
    if actor.role='discipulador' then select n.* into net from videira.networks n join videira.cells c on c.network_id=n.id where c.id=cell;
    else select n.* into net from videira.networks n where n.organization_id=actor.organization_id and videira_private.can_create_account(actor.id,'lider',n.church_id,n.id,null) limit 1;end if;
    uid:=gen_random_uuid();insert into auth.users(id,aud,role,email,created_at,updated_at) values(uid,'authenticated','authenticated',uid::text||'@accounts.videira.invalid',now(),now());
    perform public.videira_account_provision(actor.id,uid,jsonb_build_object('username','qa_'||replace(uid::text,'-',''),'display_name','Teste integralmente revertido','role','lider','church_id',net.church_id,'network_id',net.id,'phone','82999990000','birth_date','2000-01-01','card_name','Teste','creation_cell_id',case when actor.role='discipulador' then cell else null end),false);
    if not exists(select 1 from videira.profiles p join videira_private.account_creation_records r on r.profile_id=p.id where p.id=uid and p.role='lider' and p.network_id=net.id and p.church_id=net.church_id and r.created_by=actor.id and (actor.role<>'discipulador' or r.cell_id=cell)) then raise exception 'Gravação/vínculo incorreto';end if;
    sampled:=array_append(sampled,actor.role::text);
   end if;
  end if;
 end loop;
 if not(array['master','supervisor','pastor','obreiro','predio','discipulador']::text[]<@sampled) then raise exception 'Faltou teste de gravação para alguma função: %',sampled;end if;
 perform set_config('request.jwt.claim.sub','',true);if public.videira_account_creation_scope() is not null then raise exception 'Permissão anônima';end if;
 if has_function_privilege('authenticated','public.videira_account_provision(uuid,uuid,jsonb,boolean)','EXECUTE') then raise exception 'Provisionamento administrativo exposto';end if;
 raise notice 'PASS: % combinações; gravação real e vínculo para %; tudo será revertido',tested,sampled;
end $$;
rollback;
select 'PASS: funções e escopos conferidos; criação real para seis níveis; todos os registros de teste desfeitos.' as resultado;
