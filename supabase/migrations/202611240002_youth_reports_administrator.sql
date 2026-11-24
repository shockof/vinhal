begin;
-- Read-only, account-specific delegation. No profile role changes or generic RLS expansion.
create table if not exists videira_private.youth_report_administrators (
 user_id uuid primary key references videira.profiles(id) on delete cascade
);
alter table videira_private.youth_report_administrators enable row level security;
revoke all on videira_private.youth_report_administrators from public,anon,authenticated;
do $$
declare target uuid;
begin
 select id into target from videira.profiles
 where username='prvitormendes' and active and registration_deleted_at is null;
 if target is null then raise exception 'Conta ativa prvitormendes não encontrada. Confira o usuário antes de liberar relatórios.';end if;
 insert into videira_private.youth_report_administrators(user_id) values(target) on conflict do nothing;
end $$;

create or replace function videira_private.can_report_cell(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from videira.cells c join videira.networks n on n.id=c.network_id and n.organization_id=c.organization_id
  join videira.profiles p on p.organization_id=c.organization_id and p.id=auth.uid() and p.active
  where c.id=target and case
   when exists(select 1 from videira_private.youth_report_administrators a where a.user_id=p.id)
    then n.kind<>'kids' and lower(regexp_replace(btrim(n.name),'^rede[[:space:]]+','','i'))='jovens'
   else videira_private.can_cell(c.id)
  end
 );
$$;
revoke all on function videira_private.can_report_cell(uuid) from public,anon,authenticated;

create or replace function public.videira_youth_report_scope()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me videira.profiles;
begin
 select * into me from videira.profiles where id=auth.uid() and active and registration_deleted_at is null;
 if not found then raise insufficient_privilege;end if;
 if not exists(select 1 from videira_private.youth_report_administrators a where a.user_id=me.id) then return null;end if;
 return (
  with scoped_cells as materialized (
   select c.* from videira.cells c where c.active and videira_private.can_report_cell(c.id)
  ), scoped_people as materialized (
   select p.*,videira_private.membership_label(p.category,p.encounter_with_god) as membership_status
   from videira.people p join scoped_cells c on c.id=p.cell_id and c.organization_id=p.organization_id where p.active
  ), scoped_meetings as materialized (
   select m.* from videira.meetings m join scoped_cells c on c.id=m.cell_id and c.organization_id=m.organization_id where m.deleted_at is null
  )
  select jsonb_build_object(
   'report_youth_all_churches',true,
   'churches',(select coalesce(jsonb_agg(to_jsonb(c) order by c.name,c.id),'[]'::jsonb) from videira.churches c where c.organization_id=me.organization_id),
   'networks',(select coalesce(jsonb_agg(to_jsonb(n) order by n.name,n.id),'[]'::jsonb) from videira.networks n where n.organization_id=me.organization_id and n.kind<>'kids' and lower(regexp_replace(btrim(n.name),'^rede[[:space:]]+','','i'))='jovens'),
   'cells',(select coalesce(jsonb_agg(to_jsonb(c) order by c.name,c.id),'[]'::jsonb) from scoped_cells c),
   'people',(select coalesce(jsonb_agg(to_jsonb(p) order by p.full_name,p.id),'[]'::jsonb) from scoped_people p),
   'meetings',(select coalesce(jsonb_agg(to_jsonb(m) order by m.meeting_date,m.id),'[]'::jsonb) from scoped_meetings m),
   'attendance',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from videira.attendance a join scoped_meetings m on m.id=a.meeting_id join scoped_people p on p.id=a.person_id),
   'cell_leadership',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'card_name',p.card_name) order by p.display_name,p.id),'[]'::jsonb) from videira.profiles p where p.organization_id=me.organization_id and exists(select 1 from scoped_cells c where p.id in (c.leader_id,c.discipler_id))),
   'cell_trainees',(select coalesce(jsonb_object_agg(t.cell_id,t.person_id),'{}'::jsonb) from videira_private.cell_trainee t join scoped_cells c on c.id=t.cell_id),
   'profiles','[]'::jsonb
  )
 );
end $$;
revoke all on function public.videira_youth_report_scope() from public,anon;
grant execute on function public.videira_youth_report_scope() to authenticated;

do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.videira_report_courses()'::regprocedure);
 if strpos(definition,'videira_private.can_cell(p.cell_id)')=0 then raise exception 'Consulta de cursos mudou. Revise a migração.';end if;
 definition:=replace(definition,'videira_private.can_cell(p.cell_id)','videira_private.can_report_cell(p.cell_id)');
 execute definition;
end $migration$;
notify pgrst,'reload schema';
commit;
