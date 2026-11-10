begin;
create table videira_private.profile_details (
 user_id uuid primary key references videira.profiles(id),phone text not null default '',contact_email text not null default '',photo_path text,
 updated_at timestamptz not null default now(),check(length(phone)<=40),check(length(contact_email)<=254)
);
alter table videira_private.profile_details enable row level security;
revoke all on videira_private.profile_details from public,anon,authenticated;
create function public.videira_my_profile(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare me videira.profiles; detail videira_private.profile_details; mail text; new_name text; new_photo text;
begin
 select * into me from videira.profiles where id=auth.uid() and active for share;
 if me.id is null then raise exception 'Acesso indisponível' using errcode='42501';end if;
 select * into detail from videira_private.profile_details where user_id=me.id;
 if p_action='save' then
  new_name:=trim(p_data->>'display_name');mail:=lower(trim(coalesce(p_data->>'contact_email','')));
  if new_name is null or length(new_name) not between 1 and 180 then raise exception 'Informe um nome com até 180 caracteres';end if;
  if length(coalesce(p_data->>'phone',''))>40 or length(mail)>254 or (mail<>'' and mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Confira o telefone e o e-mail de contato';end if;
  new_photo:=case when p_data ? 'photo_path' then nullif(p_data->>'photo_path','') else detail.photo_path end;
  if new_photo is not null and new_photo !~ ('^'||me.id::text||'/[0-9a-f-]{36}\.jpg$') then raise exception 'Foto inválida' using errcode='42501';end if;
  update videira.profiles set display_name=new_name where id=me.id;
  insert into videira_private.profile_details(user_id,phone,contact_email,photo_path)
  values(me.id,trim(coalesce(p_data->>'phone','')),mail,new_photo)
  on conflict(user_id) do update set phone=excluded.phone,contact_email=excluded.contact_email,photo_path=excluded.photo_path,updated_at=now();
 elsif p_action<>'get' then raise exception 'Operação inválida';end if;
 select * into me from videira.profiles where id=auth.uid() and active;
 select * into detail from videira_private.profile_details where user_id=me.id;
 if detail.user_id is null then select case when email like '%@accounts.videira.invalid' then '' else coalesce(email,'') end into mail from auth.users where id=me.id;else mail:=detail.contact_email;end if;
 return jsonb_build_object('id',me.id,'display_name',me.display_name,'username',me.username,'role',me.role,'phone',coalesce(detail.phone,''),'contact_email',coalesce(mail,''),'photo_path',detail.photo_path);
end $$;
revoke all on function public.videira_my_profile(text,jsonb) from public,anon;
grant execute on function public.videira_my_profile(text,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('videira-avatars','videira-avatars',false,1048576,array['image/jpeg']) on conflict(id) do nothing;
create policy videira_avatar_read on storage.objects for select to authenticated using(bucket_id='videira-avatars' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from videira.profiles where id=auth.uid() and active));
create policy videira_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='videira-avatars' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from videira.profiles where id=auth.uid() and active));
commit;
