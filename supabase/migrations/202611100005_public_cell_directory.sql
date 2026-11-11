begin;
-- Single website binding, independent of later username changes. No private records copied.
create table videira.site_directory_settings(slug text primary key check(slug='vinhal'),organization_id uuid not null references videira.organizations);
alter table videira.site_directory_settings enable row level security;
revoke all on videira.site_directory_settings from public,anon,authenticated;
insert into videira.site_directory_settings(slug,organization_id) select 'vinhal',organization_id from videira.profiles where username='master' and role='master' and active;
do $$ begin if not exists(select 1 from videira.site_directory_settings where slug='vinhal') then raise exception 'Vincule a organização do Master ao diretório antes de ativar';end if;end $$;
create function public.videira_public_cells() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'cells',coalesce((select jsonb_agg(t order by t.name) from (
 select c.id,c.name,c.church_id,c.network_id,c.meeting_schedule,
 coalesce(nullif(concat_ws(', ',nullif(c.address_details->>'street',''),nullif(c.address_details->>'house_number',''),nullif(c.address_details->>'neighborhood',''),nullif(c.address_details->>'city',''),nullif(c.address_details->>'state',''),nullif(c.address_details->>'postal_code','')),''),c.private_address,'') as address,
 c.latitude,c.longitude,p.id as leader_id,p.display_name as leader_name
 from videira.cells c join videira.site_directory_settings s on s.organization_id=c.organization_id and s.slug='vinhal'
 left join videira.profiles p on p.id=c.leader_id and p.organization_id=c.organization_id and p.active
 where c.active)t),'[]'::jsonb),
 'churches',coalesce((select jsonb_agg(t order by t.name) from (select ch.id,ch.name,ch.municipality from videira.churches ch join videira.site_directory_settings s on s.organization_id=ch.organization_id where s.slug='vinhal')t),'[]'::jsonb),
 'networks',coalesce((select jsonb_agg(t order by t.name) from (select n.id,n.church_id,n.name,n.kind from videira.networks n join videira.site_directory_settings s on s.organization_id=n.organization_id where s.slug='vinhal')t),'[]'::jsonb)
 );
$$;
revoke all on function public.videira_public_cells() from public;
grant execute on function public.videira_public_cells() to anon,authenticated,service_role;
commit;
