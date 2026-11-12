begin;

create or replace function videira_private.protect_person_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then new.created_by=auth.uid();new.created_at=now();
 else
  if new.id<>old.id or new.organization_id<>old.organization_id then raise exception 'Identidade do cadastro não pode ser alterada'; end if;
  if new.cell_id is distinct from old.cell_id and not exists (
   select 1 from videira.profiles
   where id=auth.uid() and active and organization_id=old.organization_id
    and role in ('master','supervisor','pastor','obreiro','predio')
  ) then
   raise exception 'Seu perfil não pode transferir cadastros entre células.' using errcode='42501';
  end if;
  new.created_by=old.created_by;new.created_at=old.created_at;
 end if;
 return new;
end $$;

commit;
