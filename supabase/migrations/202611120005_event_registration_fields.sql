begin;
alter table videira.event_registrations
  add column cpf text,
  add column participant_role text,
  add column payment_method text;
create unique index event_registration_cpf_unique
  on videira.event_registrations(organization_id,event_id,cpf) where cpf is not null;
create function public.videira_event_registration_v2(
  p_event_id text, p_name text default null, p_email text default null, p_cpf text default null,
  p_role text default null, p_payment text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  org_id uuid;
  event jsonb;
  occupied integer;
  digit integer;
  total integer;
  position integer;
  digit_count integer;
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
     or attendee_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or coalesce(p_cpf, '') !~ '^[0-9]{11}$' or p_cpf = repeat(left(p_cpf, 1), 11)
     or p_role is null or p_role not in ('membro','lider','discipulador','obreiro','pastor','supervisor')
     or p_payment is null or p_payment not in ('pix','cartao') then
    return jsonb_build_object('active', true, 'confirmed', occupied, 'status', 'invalid');
  end if;
  for digit_count in 9..10 loop
    total := 0;
    for position in 1..digit_count loop
      total := total + substr(p_cpf, position, 1)::integer * (digit_count + 2 - position);
    end loop;
    digit := (total * 10) % 11;
    if (digit % 10) <> substr(p_cpf, digit_count + 1, 1)::integer then
      return jsonb_build_object('active', true, 'confirmed', occupied, 'status', 'invalid');
    end if;
  end loop;
  if exists(select 1 from videira.event_registrations where organization_id = org_id
      and event_id = p_event_id and (email = attendee_email or cpf = p_cpf)) then
    return jsonb_build_object('active', true, 'confirmed', occupied, 'status', 'received');
  end if;
  if occupied >= 300 then
    return jsonb_build_object('active', true, 'confirmed', occupied, 'status', 'full');
  end if;
  insert into videira.event_registrations (organization_id, event_id, name, email, cpf, participant_role, payment_method)
    values (org_id, p_event_id, attendee_name, attendee_email, p_cpf, p_role, p_payment);
  return jsonb_build_object('active', true, 'confirmed', occupied + 1, 'status', 'received');
end;
$$;
revoke all on function public.videira_event_registration_v2(text,text,text,text,text,text) from public;
grant execute on function public.videira_event_registration_v2(text,text,text,text,text,text) to anon, authenticated;
-- Old cached pages can still read the counter, but must refresh before submitting.
create or replace function public.videira_event_registration(
  p_event_id text, p_name text default null, p_email text default null
) returns jsonb language sql set search_path='' as $$
  select case when p_name is null and p_email is null
    then public.videira_event_registration_v2(p_event_id)
    else jsonb_build_object('active',true,'status','refresh')
  end;
$$;
commit;
