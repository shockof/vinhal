begin;
do $tests$
declare actor record; sample uuid; response jsonb; check_count integer:=0; denied boolean;
begin
 for actor in select id,role from videira.profiles where active and registration_deleted_at is null loop
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  response:=public.videira_worship('scope');
  if jsonb_typeof(response->'cells')<>'array' then raise exception 'Invalid scope';end if;
  response:=public.videira_worship('roster',jsonb_build_object('date',(now() at time zone 'America/Maceio')::date,'service','morning'));
  if exists(select 1 from jsonb_array_elements(response->'people') x join videira.people p on p.id=(x->>'id')::uuid where not videira_private.can_record_worship(p.cell_id)) then raise exception 'Roster scope leak';end if;
  if actor.role in ('master','supervisor','supervisora_kids','predio','pastor','obreiro','discipulador') then
   response:=public.videira_worship('report',jsonb_build_object('from',current_date-30,'to',current_date,'service',''));
   if jsonb_typeof(response->'rows')<>'array' then raise exception 'Invalid report';end if;
   if exists(select 1 from jsonb_array_elements(response->'rows') x where not videira_private.can_report_worship((x->>'cell_id')::uuid)) then raise exception 'Report scope leak';end if;
  else
   denied:=false;begin perform public.videira_worship('report',jsonb_build_object('from',current_date-30,'to',current_date));exception when insufficient_privilege then denied:=true;end;
   if not denied then raise exception 'Leader report was not denied';end if;
  end if;
  check_count:=check_count+1;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 denied:=false;begin perform public.videira_worship('scope');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous access was not denied';end if;
 raise notice 'Validated % active account scopes and denied anonymous access',check_count;
end $tests$;
do $save_tests$
declare actor record; c uuid; roster jsonb; payload jsonb; response jsonb; selected jsonb; blocked boolean; did_test boolean:=false; test_date date;
begin
 for actor in select id from videira.profiles where active and registration_deleted_at is null loop
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  select cell.id into c from videira.cells cell where videira_private.can_record_worship(cell.id) and exists(select 1 from videira.people p where p.cell_id=cell.id and p.active) limit 1;
  if c is null then continue;end if;
  test_date:=current_date;while exists(select 1 from videira_private.worship_calls w where w.cell_id=c and w.service_date=test_date) loop test_date:=test_date-1;end loop;
  roster:=public.videira_worship('roster',jsonb_build_object('date',test_date,'service','morning','cell',c));
  select jsonb_agg(jsonb_build_object('person_id',x->>'id','present',true)) into selected from jsonb_array_elements(roster->'people') x;
  payload:=jsonb_build_object('date',test_date,'service','morning','calls',jsonb_build_array(jsonb_build_object('cell_id',c,'revision',0,'people',selected)));
  response:=public.videira_worship('save',payload);
  if (response->>'saved')::integer<>1 then raise exception 'Save failed';end if;
  blocked:=false;begin perform public.videira_worship('save',payload);exception when serialization_failure then blocked:=true;end;
  if not blocked then raise exception 'Lost update protection failed';end if;
  payload:=jsonb_set(payload,'{calls,0,revision}','1');
  payload:=jsonb_set(payload,'{calls,0,people,0,present}','null');
  blocked:=false;begin perform public.videira_worship('save',payload);exception when raise_exception then blocked:=true;end;
  if not blocked then raise exception 'Pending attendance accepted';end if;
  roster:=public.videira_worship('roster',jsonb_build_object('date',test_date,'service','evening','cell',c));
  if exists(select 1 from jsonb_array_elements(roster->'people') x where jsonb_typeof(x->'present')<>'null') then raise exception 'Morning and evening mixed';end if;
  if (select count(*) from videira_private.worship_calls where cell_id=c and service_date=test_date)<>1 then raise exception 'Duplicate worship call';end if;
  select id into actor from videira.profiles where role='master' and active limit 1;
  perform set_config('request.jwt.claim.sub',actor.id::text,true);
  response:=public.videira_worship('report',jsonb_build_object('from',test_date,'to',test_date,'service','morning','cell',c));
  if (select sum((x->>'presences')::integer) from jsonb_array_elements(response->'rows') x)<>jsonb_array_length(selected) then raise exception 'Report totals incorrect';end if;
  did_test:=true;exit;
 end loop;
 if not did_test then raise exception 'No writable cell available for transactional save test';end if;
 if has_function_privilege('anon','public.videira_worship(text,jsonb)','execute') then raise exception 'Anonymous execution allowed';end if;
end $save_tests$;

select 'Permission, save, pending, revision, service separation and report checks passed. No permanent changes.' as result;
rollback;
