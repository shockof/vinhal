set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
do $$ declare ch uuid; net uuid; cl uuid; p uuid; result jsonb; begin
 ch:=(public.videira_portal('church','{"name":"CRUD igreja","municipality":"Município fictício"}')->>'id')::uuid;
 net:=(public.videira_portal('network',jsonb_build_object('name','Rede Kids','church_id',ch,'kind','kids'))->>'id')::uuid;
 cl:=(public.videira_portal('cell',jsonb_build_object('name','CRUD célula','church_id',ch,'network_id',net,'leader_id','90000000-0000-0000-0000-000000000001'))->>'id')::uuid;
 p:=(public.videira_portal('person',jsonb_build_object('full_name','Pessoa fictícia CRUD','cell_id',cl,'category','Visitante','baptized','Não informado','marital_status','Não informado'))->>'id')::uuid;
 perform public.videira_portal('person',jsonb_build_object('id',p,'full_name','Pessoa fictícia editada','category','Visitante','baptized','Sim','marital_status','Não informado'));
 if not exists(select 1 from videira.people where id=p and full_name='Pessoa fictícia editada') then raise exception 'FAIL edit person';end if;
 result:=public.videira_portal('meeting',jsonb_build_object('cell_id',cl,'date','2026-01-01','attendance',jsonb_build_array(jsonb_build_object('person_id',p,'present',true))));
 if (result->>'present')::int<>1 then raise exception 'FAIL meeting through portal';end if;
end $$;
reset role;
select 'PASS: portal church/network/Kids/cell/person create, person edit, attendance transaction' as crud_test;
