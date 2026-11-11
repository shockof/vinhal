begin;
-- RETURNING on inserted rows must not depend on looking up the new row in a STABLE helper.
alter policy network_read on videira.networks using (videira_private.has_org_role(organization_id,array['master','supervisor']::videira.leadership_role[]) or videira_private.can_network(id) or videira_private.is_building_pastor(organization_id,church_id));
alter policy cell_read on videira.cells using (videira_private.has_org_role(organization_id,array['master','supervisor']::videira.leadership_role[]) or videira_private.can_cell(id) or videira_private.is_building_pastor(organization_id,church_id));
create table videira.site_publications(organization_id uuid primary key references videira.organizations,slug text unique not null check(slug='vinhal'),content jsonb not null,revision bigint not null,published_at timestamptz not null default now(),published_by uuid not null references auth.users(id));
alter table videira.site_publications enable row level security;
revoke all on videira.site_publications from public,anon,authenticated;
create function public.videira_site_public() returns jsonb language sql stable security definer set search_path='' as $$ select coalesce((select jsonb_build_object('content',content,'revision',revision,'published_at',published_at) from videira.site_publications where slug='vinhal'),'{}'::jsonb); $$;
revoke all on function public.videira_site_public() from public;
grant execute on function public.videira_site_public() to anon,authenticated,service_role;
create function public.videira_site_editor(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor videira.profiles; draft videira.site_drafts; pub videira.site_publications; document jsonb;
begin
 select * into actor from videira.profiles where id=auth.uid() and active and role='master';
 if actor.id is null then raise insufficient_privilege;end if;
 perform 1 from videira.organizations where id=actor.organization_id for update;
 select * into draft from videira.site_drafts where organization_id=actor.organization_id for update;
 select * into pub from videira.site_publications where organization_id=actor.organization_id;
 if p_action<>'load' then
  if coalesce((p_data->>'revision')::bigint,0)<>coalesce(draft.revision,0) then raise exception 'O rascunho foi alterado em outra aba. Reabra o editor antes de salvar.';end if;
  if p_action='save' then
   document=p_data->'content';
   if document is null or jsonb_typeof(document)<>'object' or octet_length(document::text)>12000000 then raise exception 'Conteúdo inválido ou muito grande. Use links ou carregue as imagens na biblioteca.';end if;
   insert into videira.site_drafts(organization_id,content,revision,updated_by) values(actor.organization_id,document,1,actor.id) on conflict(organization_id) do update set content=excluded.content,revision=videira.site_drafts.revision+1,updated_at=now(),updated_by=actor.id;
  elsif p_action='publish' then
   if draft.content is null or draft.content='{}'::jsonb then raise exception 'Salve um rascunho antes de publicar';end if;
   insert into videira.site_publications(organization_id,slug,content,revision,published_by) values(actor.organization_id,'vinhal',draft.content,draft.revision,actor.id) on conflict(organization_id) do update set content=excluded.content,revision=excluded.revision,published_at=now(),published_by=actor.id;
   insert into videira.audit_log(organization_id,actor_id,action,entity,entity_id) values(actor.organization_id,actor.id,'publish_site','site_publications',actor.organization_id::text);
  elsif p_action='discard' then
   update videira.site_drafts set content='{}',revision=revision+1,updated_at=now(),updated_by=actor.id where organization_id=actor.organization_id;
  else raise exception 'Operação inválida';end if;
 end if;
 select * into draft from videira.site_drafts where organization_id=actor.organization_id;
 select * into pub from videira.site_publications where organization_id=actor.organization_id;
 return jsonb_build_object('draft',case when draft.content='{}'::jsonb then null else draft.content end,'published',pub.content,'revision',coalesce(draft.revision,0),'published_at',pub.published_at);
end $$;
revoke all on function public.videira_site_editor(text,jsonb) from public,anon;
grant execute on function public.videira_site_editor(text,jsonb) to authenticated;
-- Media is intended for the public site; random immutable paths. No public listing or writes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('videira-site-media','videira-site-media',true,52428800,array['image/png','image/jpeg','image/webp','video/mp4','video/webm','video/ogg','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','audio/mpeg']) on conflict(id) do nothing;
create policy site_media_insert on storage.objects for insert to authenticated with check(bucket_id='videira-site-media' and exists(select 1 from videira.profiles p where p.id=auth.uid() and p.active and p.role='master' and p.organization_id::text=(storage.foldername(name))[1]));
create policy site_media_read on storage.objects for select to authenticated using(bucket_id='videira-site-media' and exists(select 1 from videira.profiles p where p.id=auth.uid() and p.active and p.role='master' and p.organization_id::text=(storage.foldername(name))[1]));
commit;
