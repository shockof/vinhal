begin;
do $$
declare actor videira.profiles; target videira.profiles; net videira.networks; cell videira.cells; uid uuid; wanted boolean; actual boolean; result jsonb; data jsonb; denied boolean; sampled text[]:=array[]::text[]; bad jsonb; scope jsonb; counts integer:=0;
begin
 -- Temporary leaders/cells provide targets for every network and active discipler.
 for net in select * from videira.networks loop
  uid:=gen_random_uuid();insert into auth.users(id,aud,role,email,created_at,updated_at) values(uid,'authenticated','authenticated',uid::text||'@accounts.videira.invalid',now(),now());
  insert into videira.profiles(id,organization_id,username,display_name,role,church_id,network_id) values(uid,net.organization_id,'qa_'||replace(uid::text,'-',''),'Teste de edição revertido','lider',net.church_id,net.id);
 end loop;
 for actor in select * from videira.profiles where role='discipulador' and active and registration_deleted_at is null loop
  select * into target from videira.profiles where role='lider' and network_id=actor.network_id and username like 'qa_%' limit 1;
  if target.id is not null then
   insert into videira.cells(organization_id,church_id,network_id,name,leader_id,discipler_id,is_paused) values(actor.organization_id,actor.church_id,actor.network_id,'Teste de edição revertido',target.id,actor.id,true);
  end if;
 end loop;
 for actor in select * from videira.profiles where active and registration_deleted_at is null and username not like 'qa_%' loop
  perform set_config('request.jwt.claim.sub',actor.id::text,true);scope:=public.videira_leader_edit_scope();
  for target in select * from videira.profiles where username like 'qa_%' loop
   wanted:=case actor.role
    when 'supervisor' then actor.organization_id=target.organization_id
    when 'pastor' then actor.organization_id=target.organization_id and case when actor.username='prvitormendes' then exists(select 1 from videira.networks n where n.id=target.network_id and n.kind<>'kids' and lower(regexp_replace(btrim(n.name),'^rede[[:space:]]+','','i'))='jovens') else actor.church_id=target.church_id and actor.network_id=target.network_id end
    when 'obreiro' then actor.organization_id=target.organization_id and actor.church_id=target.church_id
    when 'discipulador' then exists(select 1 from videira.cells c where c.leader_id=target.id and c.discipler_id=actor.id and c.active and c.organization_id=actor.organization_id)
    else false end;
   actual:=videira_private.can_edit_cell_leader(actor.id,target.id);
   if actual is distinct from coalesce(wanted,false) then raise exception 'Escopo incorreto para %',actor.username;end if;
   if ((scope->'editable_leader_ids') ? target.id::text) is distinct from coalesce(wanted,false) then raise exception 'Lista incorreta para %',actor.username;end if;
   counts:=counts+1;
   if wanted and not(actor.role::text=any(sampled)) then
    result:=public.videira_account_card('get',jsonb_build_object('id',target.id));
    data:=result||jsonb_build_object('display_name','Nome de teste alterado','phone','82999990000','birth_date','2000-01-01','contact_email','qa@example.invalid','card_name','Teste','leadership_photo','/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDzSiiivpT7A//Z');
    result:=public.videira_account_card('save',data);
    if result->>'display_name'<>'Nome de teste alterado' or result->>'phone'<>'82999990000' or result->>'birth_date'<>'2000-01-01' then raise exception 'Edição não gravada';end if;
    for bad in select value from jsonb_array_elements('[{"role":"master"},{"church_id":null},{"network_id":null},{"active":false},{"new_password":"blocked"},{"organization_id":"blocked"}]'::jsonb) loop
     denied:=false;begin perform public.videira_account_card('save',data||bad);exception when insufficient_privilege then denied:=true;end;
     if not denied then raise exception 'Alteração privilegiada aceita: %',bad;end if;
    end loop;
    if public.videira_leader_account('photo',jsonb_build_object('id',target.id))->>'photo' is distinct from data->>'leadership_photo' then raise exception 'Foto não foi gravada';end if;
    sampled:=array_append(sampled,actor.role::text);
   elsif not wanted and actor.role<>'master' then
    denied:=false;begin perform public.videira_account_card('get',jsonb_build_object('id',target.id));exception when insufficient_privilege then denied:=true;end;
    if not denied then raise exception 'Leitura fora do escopo';end if;
   end if;
  end loop;
  -- A leader editor must never edit a pastor, discipler, supervisor or Master account.
  if actor.role<>'master' then
   for target in select * from videira.profiles where role<>'lider' and organization_id=actor.organization_id loop
    if videira_private.can_edit_cell_leader(actor.id,target.id) then raise exception 'Permissão para editar função superior';end if;
   end loop;
  end if;
 end loop;
 if not(array['supervisor','pastor','obreiro','discipulador']::text[]<@sampled) then raise exception 'Edição não testada para todas as funções: %',sampled;end if;
 select * into actor from videira.profiles where role='master' and active limit 1;
 perform set_config('request.jwt.claim.sub',actor.id::text,true);
 select * into target from videira.profiles where username like 'qa_%' limit 1;
 result:=public.videira_account_card('get',jsonb_build_object('id',target.id));
 if result ? 'delegated_edit' then raise exception 'Editor Master alterado';end if;
 perform set_config('request.jwt.claim.sub','',true);
 if jsonb_array_length(public.videira_leader_edit_scope()->'editable_leader_ids')<>0 then raise exception 'Escopo anônimo';end if;
 raise notice 'PASS: % pares, edição real nas quatro funções, limites e Master preservados',counts;
end $$;
rollback;
select 'PASS: edição para Supervisor, Pastor de Rede, Obreiro e Discipulador; acesso fora do escopo bloqueado; testes desfeitos.' as resultado;
