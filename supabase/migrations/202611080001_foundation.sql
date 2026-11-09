-- Prepared foundation for a NEW Supabase project. Not yet applied or integration-tested.
-- No credentials, Auth users, organizations or real personal records are seeded.
begin;
create schema if not exists videira;
create schema if not exists videira_private;
revoke all on schema videira from public, anon;
revoke all on schema videira_private from public, anon;
grant usage on schema videira, videira_private to authenticated;

create type videira.leadership_role as enum ('master','supervisor','pastor','obreiro','discipulador','lider');
create type videira.person_category as enum ('Visitante','Membro');

create table videira.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 180),
 created_at timestamptz not null default now()
);
create table videira.churches (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references videira.organizations,
 name text not null check(length(trim(name)) between 1 and 180), municipality text not null,
 created_at timestamptz not null default now(), unique(id,organization_id)
);
create table videira.networks (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, church_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 180), kind text not null default 'regular' check(kind in ('regular','kids')),
 foreign key(church_id,organization_id) references videira.churches(id,organization_id),
 unique(id,organization_id), unique(id,church_id,organization_id), unique(church_id,name)
);
create table videira.profiles (
 id uuid primary key references auth.users(id), organization_id uuid not null references videira.organizations,
 username text not null unique check(username ~ '^[a-z0-9][a-z0-9._-]{2,49}$'),
 display_name text not null, role videira.leadership_role not null,
 church_id uuid, network_id uuid, active boolean not null default true,
 created_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(church_id,organization_id) references videira.churches(id,organization_id),
 foreign key(network_id,church_id,organization_id) references videira.networks(id,church_id,organization_id),
 check(role in ('master','supervisor') or church_id is not null),
 check(role not in ('pastor','discipulador','lider') or network_id is not null)
);
create table videira.cells (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, church_id uuid not null, network_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 180), leader_id uuid, discipler_id uuid,
 meeting_schedule text, private_address text, latitude double precision, longitude double precision,
 active boolean not null default true, created_at timestamptz not null default now(),
 foreign key(network_id,church_id,organization_id) references videira.networks(id,church_id,organization_id),
 foreign key(leader_id,organization_id) references videira.profiles(id,organization_id),
 foreign key(discipler_id,organization_id) references videira.profiles(id,organization_id),
 unique(id,organization_id),
 check((latitude is null and longitude is null) or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180))
);
create table videira.people (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, cell_id uuid not null,
 full_name text not null check(length(trim(full_name)) between 1 and 180), phone text,
 category videira.person_category not null default 'Visitante', baptized text not null default 'Não informado',
 marital_status text not null default 'Não informado', active boolean not null default true,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id) default auth.uid(),
 foreign key(cell_id,organization_id) references videira.cells(id,organization_id), unique(id,cell_id)
);
create table videira.meetings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, cell_id uuid not null,
 meeting_date date not null, created_at timestamptz not null default now(), recorded_by uuid not null references auth.users(id),
 foreign key(cell_id,organization_id) references videira.cells(id,organization_id), unique(cell_id,meeting_date), unique(id,cell_id)
);
create table videira.attendance (
 meeting_id uuid not null, person_id uuid not null, cell_id uuid not null, present boolean not null,
 primary key(meeting_id,person_id),
 foreign key(meeting_id,cell_id) references videira.meetings(id,cell_id),
 foreign key(person_id,cell_id) references videira.people(id,cell_id)
);
create table videira.site_drafts (
 organization_id uuid primary key references videira.organizations, content jsonb not null default '{}',
 revision bigint not null default 1, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table videira.audit_log (
 id bigint generated always as identity primary key, organization_id uuid not null references videira.organizations,
 actor_id uuid references auth.users(id), action text not null, entity text not null, entity_id text,
 occurred_at timestamptz not null default now()
);

alter table videira.organizations enable row level security;
alter table videira.churches enable row level security;
alter table videira.networks enable row level security;
alter table videira.profiles enable row level security;
alter table videira.cells enable row level security;
alter table videira.people enable row level security;
alter table videira.meetings enable row level security;
alter table videira.attendance enable row level security;
alter table videira.site_drafts enable row level security;
alter table videira.audit_log enable row level security;

-- SECURITY DEFINER reads profiles without recursive RLS. No caller-supplied user ID.
create function videira_private.has_org_role(org uuid, roles videira.leadership_role[])
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from videira.profiles p where p.id=auth.uid() and p.active and p.organization_id=org and p.role=any(roles));
$$;
create function videira_private.can_cell(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from videira.cells c join videira.profiles p on p.organization_id=c.organization_id
 where c.id=target and p.id=auth.uid() and p.active and (
 p.role in ('master','supervisor') or (p.role='obreiro' and p.church_id=c.church_id) or
 (p.role='pastor' and p.network_id=c.network_id) or (p.role='discipulador' and c.discipler_id=p.id) or
 (p.role='lider' and c.leader_id=p.id)));
$$;
create function videira_private.can_church(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from videira.profiles p join videira.churches c on c.organization_id=p.organization_id
 where p.id=auth.uid() and p.active and c.id=target and (p.role in ('master','supervisor') or p.church_id=c.id));
$$;
create function videira_private.can_network(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from videira.profiles p join videira.networks n on n.organization_id=p.organization_id
 where p.id=auth.uid() and p.active and n.id=target and (p.role in ('master','supervisor') or
 (p.role='obreiro' and p.church_id=n.church_id) or p.network_id=n.id));
$$;
revoke all on all functions in schema videira_private from public,anon;
grant execute on all functions in schema videira_private to authenticated;

-- No registration trigger: signing up alone grants no profile, role or organization.
-- Profiles and roles are provisioned only by the trusted account-management service.
do $$ declare t text; begin
 foreach t in array array['organizations','churches','networks','profiles','cells','people','meetings','attendance','site_drafts','audit_log'] loop
 execute format('alter table videira.%I enable row level security',t);
 execute format('revoke all on videira.%I from public,anon,authenticated',t);
 execute format('grant select on videira.%I to authenticated',t);
 end loop;
end $$;
grant insert,update on videira.churches,videira.networks,videira.cells,videira.people,videira.site_drafts to authenticated;
create policy organization_read on videira.organizations for select to authenticated using (
 exists(select 1 from videira.profiles p where p.id=auth.uid() and p.active and p.organization_id=videira.organizations.id)
);
create policy profile_read on videira.profiles for select to authenticated using (
 (id=auth.uid() and active) or videira_private.has_org_role(organization_id,array['master','supervisor']::videira.leadership_role[])
);
create policy church_read on videira.churches for select to authenticated using (videira_private.can_church(id));
create policy network_read on videira.networks for select to authenticated using (videira_private.can_network(id));
create policy cell_read on videira.cells for select to authenticated using (videira_private.can_cell(id));
create policy people_read on videira.people for select to authenticated using (videira_private.can_cell(cell_id));
create policy people_insert on videira.people for insert to authenticated with check (videira_private.can_cell(cell_id));
create policy people_update on videira.people for update to authenticated using (videira_private.can_cell(cell_id)) with check (videira_private.can_cell(cell_id));
create policy meeting_read on videira.meetings for select to authenticated using (videira_private.can_cell(cell_id));
create policy attendance_read on videira.attendance for select to authenticated using (videira_private.can_cell(cell_id));
create policy draft_read on videira.site_drafts for select to authenticated using (videira_private.has_org_role(organization_id,array['master']::videira.leadership_role[]));
create policy draft_insert on videira.site_drafts for insert to authenticated with check (videira_private.has_org_role(organization_id,array['master']::videira.leadership_role[]));
create policy draft_update on videira.site_drafts for update to authenticated using (videira_private.has_org_role(organization_id,array['master']::videira.leadership_role[])) with check (videira_private.has_org_role(organization_id,array['master']::videira.leadership_role[]));
create policy audit_read on videira.audit_log for select to authenticated using (videira_private.has_org_role(organization_id,array['master','supervisor']::videira.leadership_role[]));
do $$ declare t text; begin
 foreach t in array array['churches','networks','cells'] loop
 execute format('create policy structure_insert on videira.%I for insert to authenticated with check (videira_private.has_org_role(organization_id,array[''master'',''supervisor'']::videira.leadership_role[]))',t);
 execute format('create policy structure_update on videira.%I for update to authenticated using (videira_private.has_org_role(organization_id,array[''master'',''supervisor'']::videira.leadership_role[])) with check (videira_private.has_org_role(organization_id,array[''master'',''supervisor'']::videira.leadership_role[]))',t);
 end loop;
end $$;

-- Private by default. No anonymous storage policies or public residential directory.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('videira-private','videira-private',false,20971520,array['image/png','image/jpeg','image/webp','application/pdf'])
 on conflict(id) do nothing;
create policy videira_files_read on storage.objects for select to authenticated using (
 bucket_id='videira-private' and exists(select 1 from videira.cells c
 where c.id::text=(storage.foldername(name))[1] and videira_private.can_cell(c.id))
);
create policy videira_files_insert on storage.objects for insert to authenticated with check (
 bucket_id='videira-private' and exists(select 1 from videira.cells c
 where c.id::text=(storage.foldername(name))[1] and videira_private.can_cell(c.id))
);
-- Uploads use immutable UUID paths. Update and deletion are not granted.
create index on videira.profiles(organization_id,role) where active;
create index on videira.cells(organization_id,network_id);
create index on videira.cells(leader_id);
create index on videira.cells(discipler_id);
create index on videira.people(cell_id);
create index on videira.meetings(cell_id,meeting_date desc);
create index on videira.attendance(person_id,meeting_id);
create index on videira.audit_log(organization_id,occurred_at desc);
commit;
