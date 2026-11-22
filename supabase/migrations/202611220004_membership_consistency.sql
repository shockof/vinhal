begin;
create or replace function videira_private.enforce_church_membership()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.encounter_with_god then new.category:='Membro'; end if;
 return new;
end $$;
revoke all on function videira_private.enforce_church_membership() from public,anon,authenticated;
create trigger enforce_church_membership before insert or update of category,encounter_with_god on videira.people
for each row execute function videira_private.enforce_church_membership();
commit;
