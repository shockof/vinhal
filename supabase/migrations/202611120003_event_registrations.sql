begin;

create table videira.event_registrations (
  organization_id uuid not null references videira.organizations,
  event_id text not null,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, event_id, email)
);
alter table videira.event_registrations enable row level security;
revoke all on videira.event_registrations from public, anon, authenticated;

create function public.videira_event_registration(
  p_event_id text, p_name text default null, p_email text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  org_id uuid;
  event jsonb;
  occupied integer;
  attendee_name text := trim(p_name);
  attendee_email text := lower(trim(p_email));
begin
  select organization_id into org_id from videira.site_publications where slug = 'vinhal';
  if org_id is null then return jsonb_build_object('active', false); end if;

  -- Serialize signups with each other and with CMS publication.
  perform 1 from videira.organizations where id = org_id for update;
  select content->'registrations' into event
    from videira.site_publications where slug = 'vinhal';
  if event->'enabled' is distinct from 'true'::jsonb
     or event->>'id' is distinct from p_event_id
     or coalesce(p_event_id, '') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    return jsonb_build_object('active', false);
  end if;

  select count(*) into occupied from videira.event_registrations
    where organization_id = org_id and event_id = p_event_id;
  if p_name is null and p_email is null then
    return jsonb_build_object('active', true, 'confirmed', occupied);
  end if;
  if attendee_name is null or char_length(attendee_name) not between 2 and 120
     or attendee_email is null or char_length(attendee_email) > 254
     or attendee_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('active', true, 'confirmed', occupied, 'status', 'invalid');
  end if;
  if exists(select 1 from videira.event_registrations where organization_id = org_id
      and event_id = p_event_id and email = attendee_email) then
    return jsonb_build_object('active', true, 'confirmed', occupied, 'status', 'received');
  end if;
  if occupied >= 300 then
    return jsonb_build_object('active', true, 'confirmed', occupied, 'status', 'full');
  end if;
  insert into videira.event_registrations (organization_id, event_id, name, email)
    values (org_id, p_event_id, attendee_name, attendee_email);
  return jsonb_build_object('active', true, 'confirmed', occupied + 1, 'status', 'received');
end;
$$;
revoke all on function public.videira_event_registration(text,text,text) from public;
grant execute on function public.videira_event_registration(text,text,text) to anon, authenticated;
commit;
