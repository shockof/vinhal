begin;
create table videira_private.leadership_photos (
  user_id uuid primary key references videira.profiles on delete cascade,
  photo text not null check (length(photo) between 4 and 800000)
);
alter table videira_private.leadership_photos enable row level security;
revoke all on videira_private.leadership_photos from public, anon, authenticated;

create function public.videira_leadership_photo(p_id uuid, p_photo text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare image text;
begin
  if not exists (
    select 1 from videira.profiles actor join videira.profiles target
      on target.organization_id=actor.organization_id
    where actor.id=auth.uid() and actor.active and actor.role='master' and target.id=p_id
  ) then raise insufficient_privilege; end if;
  if p_photo = '' then
    delete from videira_private.leadership_photos where user_id=p_id;
  elsif p_photo is not null then
    if length(p_photo)>800000 or p_photo !~ '^/9j/[A-Za-z0-9+/]*={0,2}$' then
      raise exception 'Foto JPEG inválida ou muito grande.';
    end if;
    insert into videira_private.leadership_photos values(p_id,p_photo)
      on conflict(user_id) do update set photo=excluded.photo;
  end if;
  select photo into image from videira_private.leadership_photos where user_id=p_id;
  return jsonb_build_object('photo',image);
end;
$$;
revoke all on function public.videira_leadership_photo(uuid,text) from public,anon;
grant execute on function public.videira_leadership_photo(uuid,text) to authenticated;

create function public.videira_public_leadership()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.display_name,'role',p.role,'church',ch.name,
    'photo',a.user_id is not null
  ) order by array_position(array['supervisor','predio','pastor','obreiro','discipulador','lider'],p.role::text),lower(p.display_name),p.id),'[]'::jsonb)
  from videira.site_directory_settings s
  join videira.profiles p on p.organization_id=s.organization_id
  left join videira.churches ch on ch.id=p.church_id and ch.organization_id=p.organization_id
  left join videira_private.leadership_photos a on a.user_id=p.id
  where s.slug='vinhal' and p.active and p.role in ('supervisor','predio','pastor','obreiro','discipulador','lider');
$$;
create function public.videira_public_leadership_photo(p_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select a.photo from videira.site_directory_settings s
  join videira.profiles p on p.organization_id=s.organization_id
  join videira_private.leadership_photos a on a.user_id=p.id
  where s.slug='vinhal' and p.id=p_id and p.active
    and p.role in ('supervisor','predio','pastor','obreiro','discipulador','lider');
$$;
revoke all on function public.videira_public_leadership(),public.videira_public_leadership_photo(uuid) from public;
grant execute on function public.videira_public_leadership(),public.videira_public_leadership_photo(uuid) to anon,authenticated;
commit;
