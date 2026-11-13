begin;
-- Keep registration writes serialized with CMS publishing. Polling is read-only.
alter function public.videira_event_registration_v2(text,text,text,text,text,text)
  rename to videira_event_registration_write;
revoke all on function public.videira_event_registration_write(text,text,text,text,text,text)
  from public, anon, authenticated;

create function public.videira_event_registration_v2(
  p_event_id text, p_name text default null, p_email text default null,
  p_cpf text default null, p_role text default null, p_payment text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_name is not null or p_email is not null then
    return public.videira_event_registration_write(p_event_id,p_name,p_email,p_cpf,p_role,p_payment);
  end if;

  return coalesce((
    select jsonb_build_object('active',true,'confirmed',(
      select count(*) from videira.event_registrations r
      where r.organization_id=s.organization_id and r.event_id=p_event_id
    ))
    from videira.site_publications s
    where s.slug='vinhal'
      and s.content->'registrations'->'enabled'='true'::jsonb
      and s.content->'registrations'->>'id'=p_event_id
      and p_event_id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  ),jsonb_build_object('active',false));
end;
$$;
revoke all on function public.videira_event_registration_v2(text,text,text,text,text,text) from public;
grant execute on function public.videira_event_registration_v2(text,text,text,text,text,text) to anon,authenticated;

create or replace function public.videira_event_registration(
  p_event_id text, p_name text default null, p_email text default null
) returns jsonb language sql set search_path='' as $$
  select case when p_name is null and p_email is null
    then public.videira_event_registration_v2(p_event_id)
    else jsonb_build_object('active',true,'status','refresh')
  end;
$$;
commit;
