begin;
select set_config('request.jwt.claim.sub',(select id::text from videira.profiles where username='prvitormendes'),true);
select set_config('qa.foreign_cell',(select c.id::text from videira.cells c join videira.networks n on n.id=c.network_id where c.active and n.kind='regular' and n.name='Adultos' limit 1),true);
do $$ declare c videira.cells; expected boolean; begin
 for c in select * from videira.cells loop
 expected:=c.active and exists(select 1 from videira.networks n where n.id=c.network_id and n.kind<>'kids' and lower(regexp_replace(btrim(n.name),'^rede[[:space:]]+','','i'))='jovens');
 if videira_private.can_edit_youth_cell(c.id) is distinct from expected then raise exception 'Escopo incorreto';end if;
 end loop;
end $$;
set local role authenticated;
do $$ declare n jsonb; result jsonb; cid uuid; denied boolean:=false;begin
 select value into n from jsonb_array_elements(public.videira_account_creation_scope()->'networks') limit 1;
 result:=public.videira_portal('cell',jsonb_build_object('name','QA REVERTIDO','church_id',n->>'church_id','network_id',n->>'id','is_paused',true));cid:=(result->>'id')::uuid;
 perform public.videira_portal('cell',jsonb_build_object('id',cid,'name','QA EDICAO REVERTIDA','is_paused',true));
 if not exists(select 1 from videira.cells where id=cid and name='QA EDICAO REVERTIDA') then raise exception 'Edição não gravada';end if;
 begin perform public.videira_portal('cell',jsonb_build_object('id',current_setting('qa.foreign_cell'),'name','BLOQUEADO'));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Edição fora de Jovens aceita';end if;
end $$;
reset role;
rollback;
select 'PASS: Pr Vitor pode editar células de Jovens; outras redes bloqueadas; teste desfeito.' as resultado;
