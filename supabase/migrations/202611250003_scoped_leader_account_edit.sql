begin;
create or replace function videira_private.can_edit_cell_leader(actor uuid,target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from videira.profiles me join videira.profiles p on p.organization_id=me.organization_id
 where me.id=actor and me.active and me.registration_deleted_at is null and p.id=target and p.role='lider' and p.registration_deleted_at is null
 and case me.role
 when 'supervisor' then true
 when 'pastor' then case when exists(select 1 from videira_private.youth_registration_administrators a where a.user_id=me.id)
 then videira_private.youth_registration_network(me.id,p.network_id,p.church_id)
 else p.network_id=me.network_id and p.church_id=me.church_id end
 when 'obreiro' then p.church_id=me.church_id
 when 'discipulador' then
 exists(select 1 from videira.cells c where c.active and c.organization_id=me.organization_id and c.discipler_id=me.id and c.leader_id=p.id)
 or exists(select 1 from videira_private.member_leader_access l join videira.people member on member.id=l.member_id join videira.cells c on c.id=member.cell_id where l.profile_id=p.id and member.active and c.active and c.discipler_id=me.id and c.organization_id=me.organization_id)
 or exists(select 1 from videira_private.account_creation_records r join videira.cells c on c.id=r.cell_id where r.profile_id=p.id and r.created_by=me.id and c.active and c.discipler_id=me.id and c.organization_id=me.organization_id and p.church_id=c.church_id and p.network_id=c.network_id)
 else false end);
$$;
revoke all on function videira_private.can_edit_cell_leader(uuid,uuid) from public,anon,authenticated;
create or replace function public.videira_leader_edit_scope()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('editable_leader_ids',coalesce(jsonb_agg(p.id),'[]'),
 'profiles',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'card_name',p.card_name,'display_name',p.display_name,'role',p.role,'church_id',p.church_id,'network_id',p.network_id,'active',p.active)),'[]'))
 from videira.profiles p where videira_private.can_edit_cell_leader(auth.uid(),p.id);
$$;
revoke all on function public.videira_leader_edit_scope() from public,anon;
grant execute on function public.videira_leader_edit_scope() to authenticated;
create or replace function public.videira_leader_account(p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me videira.profiles; target videira.profiles; details videira_private.profile_details; nm text; uname text; ph text; mail text; alias text; image text;
begin
 if p_action not in ('get','save','photo') then raise insufficient_privilege;end if;
 select * into me from videira.profiles where id=auth.uid() and active and registration_deleted_at is null for share;
 if not found then raise insufficient_privilege;end if;
 select * into target from videira.profiles where id=(p_data->>'id')::uuid for update;
 if not found or not videira_private.can_edit_cell_leader(me.id,target.id) then raise exception 'Líder fora da sua permissão de edição' using errcode='42501';end if;
 if p_action='photo' then return jsonb_build_object('photo',(select photo from videira_private.leadership_photos where user_id=target.id));end if;
 if p_action='save' then
  if (p_data ? 'role' and p_data->>'role' is distinct from target.role::text)
   or (p_data ? 'church_id' and nullif(p_data->>'church_id','')::uuid is distinct from target.church_id)
   or (p_data ? 'network_id' and nullif(p_data->>'network_id','')::uuid is distinct from target.network_id)
   or (p_data ? 'active' and (p_data->>'active')::boolean is distinct from target.active)
   or p_data ?| array['password','new_password','photo_path','organization_id'] then raise exception 'Função, igreja, rede, situação de acesso e senha são mantidas nesta edição' using errcode='42501';end if;
  nm:=btrim(p_data->>'display_name');uname:=lower(btrim(p_data->>'username'));ph:=btrim(coalesce(p_data->>'phone',''));mail:=btrim(coalesce(p_data->>'contact_email',''));
  if nm is null or length(nm) not between 1 and 180 then raise exception 'Informe o nome completo';end if;
  if uname is null or uname !~ '^[a-z0-9][a-z0-9._-]{2,49}$' then raise exception 'Nome de usuário inválido';end if;
  if length(ph)>40 or length(mail)>254 or (mail<>'' and mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Confira o telefone e o e-mail de contato';end if;
  alias:=case when p_data ? 'card_name' then nullif(btrim(p_data->>'card_name'),'') else target.card_name end;
  if length(alias)>80 then raise exception 'Use até 80 caracteres no nome de exibição';end if;
  if p_data ? 'leadership_photo' then
   image:=nullif(p_data->>'leadership_photo','');
   if image is not null and (length(image)>800000 or image !~ '^/9j/[A-Za-z0-9+/]*={0,2}$') then raise exception 'Foto JPEG inválida';end if;
  end if;
  update videira.profiles set display_name=nm,username=uname,card_name=alias where id=target.id returning * into target;
  insert into videira_private.profile_details(user_id,phone,contact_email,birth_date)
   values(target.id,ph,mail,videira_private.parse_birth_date(p_data->>'birth_date'))
   on conflict(user_id) do update set phone=excluded.phone,contact_email=excluded.contact_email,
   birth_date=case when p_data ? 'birth_date' then excluded.birth_date else profile_details.birth_date end,updated_at=now();
  if p_data ? 'leadership_photo' then
   if image is null then delete from videira_private.leadership_photos where user_id=target.id;
   else insert into videira_private.leadership_photos(user_id,photo) values(target.id,image) on conflict(user_id) do update set photo=excluded.photo;end if;
  end if;
 end if;
 select * into details from videira_private.profile_details where user_id=target.id;
 return jsonb_build_object('id',target.id,'display_name',target.display_name,'username',target.username,'card_name',target.card_name,'role',target.role,'church_id',target.church_id,'network_id',target.network_id,'active',target.active,'birth_date',details.birth_date,'phone',coalesce(details.phone,''),'contact_email',coalesce(details.contact_email,''),'delegated_edit',true);
end $$;
revoke all on function public.videira_leader_account(text,jsonb) from public,anon;
grant execute on function public.videira_leader_account(text,jsonb) to authenticated;
do $migration$
declare definition text; anchor text:='account := public.videira_admin_account(p_action,p_data);';
begin
 definition:=pg_get_functiondef('public.videira_account_card(text,jsonb)'::regprocedure);
 if strpos(definition,'public.videira_leader_account')=0 then
  if strpos(definition,anchor)=0 then raise exception 'Revise a função atual de edição';end if;
  definition:=replace(definition,anchor,$body$
  if not exists(select 1 from videira.profiles where id=auth.uid() and active and registration_deleted_at is null and role='master') then
   return public.videira_leader_account(p_action,p_data);
  end if;
  account := public.videira_admin_account(p_action,p_data);
$body$);
  execute definition;
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
