-- ONE-TIME administrative bootstrap. Review the sole Auth user before running.
-- No password, e-mail or personal identifier is embedded here.
-- Requires explicit approval to grant full Master access.
begin;
do $$
declare target_user uuid; target_org uuid;
begin
 if (select count(*) from auth.users) <> 1 then
  raise exception 'Expected exactly one reviewed Auth user';
 end if;
 if exists(select 1 from videira.profiles) or exists(select 1 from videira.organizations) then
  raise exception 'Bootstrap requires empty organizations and profiles';
 end if;
 select id into target_user from auth.users;
 insert into videira.organizations(name) values ('Igreja Videira') returning id into target_org;
 insert into videira.profiles(id,organization_id,username,display_name,role)
 values(target_user,target_org,'master','Administrador Master','master');
end $$;
select username,role,active from videira.profiles where username='master';
commit;
