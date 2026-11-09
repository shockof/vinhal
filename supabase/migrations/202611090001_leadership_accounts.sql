begin;
-- Server-only provisioning; the acting account is verified by Auth in the gateway.
-- No browser may execute this function or choose an organization/administrative role.
create function public.videira_account_provision(p_actor uuid,p_auth_user uuid,p_data jsonb,p_check_only boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor videira.profiles; target_role videira.leadership_role; target_church uuid; target_network uuid; target_username text; target_name text;
begin
 select * into actor from videira.profiles where id=p_actor and active and role='master' for share;
 if actor.id is null then raise exception 'Somente o Master pode cadastrar acessos' using errcode='42501';end if;
 if coalesce(p_data->>'role','') not in ('lider','discipulador','pastor','obreiro') then raise exception 'Função não permitida' using errcode='42501';end if;
 target_role:=(p_data->>'role')::videira.leadership_role;
 target_username:=lower(trim(p_data->>'username'));target_name:=trim(p_data->>'display_name');
 if target_username is null or target_username !~ '^[a-z0-9][a-z0-9._-]{2,49}$' then raise exception 'Usuário: use de 3 a 50 letras minúsculas, números, ponto, hífen ou sublinhado';end if;
 if target_name is null or length(target_name) not between 1 and 180 then raise exception 'Informe um nome com até 180 caracteres';end if;
 target_church:=nullif(p_data->>'church_id','')::uuid;target_network:=nullif(p_data->>'network_id','')::uuid;
 if not exists(select 1 from videira.churches where id=target_church and organization_id=actor.organization_id) then raise exception 'Selecione uma igreja da sua organização';end if;
 if target_role in ('lider','discipulador','pastor') and target_network is null then raise exception 'Selecione a rede desta função';end if;
 if target_network is not null and not exists(select 1 from videira.networks where id=target_network and church_id=target_church and organization_id=actor.organization_id) then raise exception 'A rede precisa pertencer à igreja selecionada';end if;
 if exists(select 1 from videira.profiles where username=target_username) then raise exception 'Nome de usuário já cadastrado' using errcode='23505';end if;
 if p_check_only then return jsonb_build_object('ok',true);end if;
 if p_auth_user is null or not exists(select 1 from auth.users where id=p_auth_user) then raise exception 'Conta de autenticação indisponível';end if;
 -- Supply the verified actor for the existing audit trigger, transaction-locally.
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 insert into videira.profiles(id,organization_id,username,display_name,role,church_id,network_id)
 values(p_auth_user,actor.organization_id,target_username,target_name,target_role,target_church,target_network);
 return jsonb_build_object('id',p_auth_user,'username',target_username,'role',target_role);
end $$;
revoke all on function public.videira_account_provision(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.videira_account_provision(uuid,uuid,jsonb,boolean) to service_role;
commit;
