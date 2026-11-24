begin;
do $migration$
declare definition text; anchor constant text := 'if not found then raise exception ''Célula indisponível''; end if;';
begin
 definition:=pg_get_functiondef('videira.record_meeting(uuid,date,jsonb)'::regprocedure);
 if strpos(definition,'c.leader_id is distinct from auth.uid()')=0 then
  if strpos(definition,anchor)=0 then raise exception 'A validação da chamada mudou; revise a função antes de aplicar.';end if;
  execute replace(definition,anchor,anchor||E'\n if c.leader_id is distinct from auth.uid() then raise exception ''Somente o líder vinculado à célula pode registrar a chamada'' using errcode=''42501'';end if;');
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
