begin;

create or replace function videira_private.monthly_birthdays() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me videira.profiles;
 current_month integer:=extract(month from now() at time zone 'America/Maceio');
begin
 select * into me from videira.profiles where id=auth.uid() and active;
 if me.id is null then raise insufficient_privilege; end if;

 return jsonb_build_object('month',current_month,'entries',coalesce((
  select jsonb_agg(to_jsonb(entry) order by entry.day,entry.name)
  from (
   select p.full_name as name,p.category::text as kind,c.name as group_name,
     extract(day from p.birth_date)::integer as day,
     case when exists(select 1 from videira_private.person_photos f where f.person_id=p.id) then p.id end as member_photo_id,
     null::text as avatar_path
   from videira.people p
   join videira.cells c on c.id=p.cell_id
   where p.organization_id=me.organization_id and p.active and c.active
     and p.category='Membro'
     and extract(month from p.birth_date)=current_month
     and videira_private.can_cell(c.id)
   union all
   select p.display_name,p.role::text,coalesce(linked.names,ch.name),
     extract(day from d.birth_date)::integer,null::uuid,d.photo_path
   from videira.profiles p
   join videira_private.profile_details d on d.user_id=p.id
   left join videira.churches ch on ch.id=p.church_id
   left join lateral (
    select string_agg(distinct c.name, ', ' order by c.name) as names
    from videira.cells c
    where c.organization_id=me.organization_id and c.active
      and p.id in (c.leader_id,c.discipler_id) and videira_private.can_cell(c.id)
   ) linked on true
   where p.organization_id=me.organization_id and p.active
     and extract(month from d.birth_date)=current_month
     and (
       p.id=me.id
       or me.role in ('master','supervisor')
       or (me.role in ('predio','obreiro') and p.church_id=me.church_id)
       or (me.role='pastor' and p.network_id=me.network_id)
       or exists (
         select 1 from videira.cells c
         where c.organization_id=me.organization_id and c.active
           and p.id in (c.leader_id,c.discipler_id)
           and videira_private.can_cell(c.id)
       )
     )
  ) entry
 ),'[]'::jsonb));
end $$;

commit;
