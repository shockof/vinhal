begin;
-- Keep paused cells in the directory with an explicit status; do not alter registrations.
do $$
declare d text:=pg_get_functiondef('public.videira_public_cells()'::regprocedure);
begin
 if strpos(d,'c.network_id,c.meeting_schedule,')=0 or strpos(d,'where c.active and not c.is_paused')=0 then
  raise exception 'Revise a consulta pública de células antes de aplicar';
 end if;
 d:=replace(d,'c.network_id,c.meeting_schedule,','c.network_id,c.meeting_schedule,c.is_paused,');
 execute replace(d,'where c.active and not c.is_paused','where c.active');
end $$;
commit;
