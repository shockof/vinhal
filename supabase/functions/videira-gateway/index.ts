// The browser receives no service key and no username/email mapping.
const base = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins = new Set(['https://shockof.github.io','http://127.0.0.1:8765','http://localhost:8765']);
Deno.serve(async (req: Request) => {
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://shockof.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-videira-session','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply({error:'Origem não permitida'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método não permitido'},405);
 if(Number(req.headers.get('content-length')||0)>1000000)return reply({error:'Pedido muito grande'},413);
 try {
  const raw=await req.text(); if(raw.length>1000000)return reply({error:'Pedido muito grande'},413);
  const body=JSON.parse(raw);
  if(body.action==='login') {
   const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');
   if(!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)||password.length<1||password.length>1024)return reply({error:'Usuário ou senha inválidos. Aguarde antes de tentar novamente.'},401);
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+ip)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const lookup=await fetch(base+'/rest/v1/rpc/videira_login_lookup',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p_username:username,p_ip_hash:hash})});
   if(!lookup.ok)return reply({error:'Login temporariamente indisponível'},503);
   const email=await lookup.json();
   if(!email){await new Promise(r=>setTimeout(r,650));return reply({error:'Usuário ou senha inválidos. Aguarde antes de tentar novamente.'},401)}
   const response=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:secret,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
   const session=await response.json();
   if(!response.ok)return reply({error:'Usuário ou senha inválidos. Aguarde antes de tentar novamente.'},401);
   return reply({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in});
  }
  const token=req.headers.get('x-videira-session')||'';
  if(!token||token===secret)return reply({error:'Entre novamente'},401);
  const checked=await fetch(base+'/auth/v1/user',{headers:{apikey:secret,Authorization:'Bearer '+token}});
  if(!checked.ok)return reply({error:'Sessão encerrada. Entre novamente.'},401);
  if(body.action==='create_account'){
   const actor=await checked.json(),d=body.data||{};
   // Verify the caller's current profile before invoking any privileged Auth operation.
   const scope=await fetch(base+'/rest/v1/rpc/videira_portal',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_action:'load',p_data:{}})});
   if(!scope.ok)return reply({error:'Acesso indisponível'},403);
   const context=await scope.json();
   if(context.profile?.role!=='master'||!context.profile?.active)return reply({error:'Somente o Master pode cadastrar acessos.'},403);
   const contactEmail=String(d.email||'').trim().toLowerCase(),password=String(d.password||'');
   // Auth still requires an identity address; use a non-deliverable random alias when omitted.
   const email=contactEmail||crypto.randomUUID()+'@accounts.videira.invalid';
   if(contactEmail&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)||contactEmail.length>254))return reply({error:'Informe um e-mail válido para a conta.'},400);
   if(password.length<12||password.length>128)return reply({error:'A senha inicial deve ter entre 12 e 128 caracteres.'},400);
   const profile={username:String(d.username||'').trim().toLowerCase(),display_name:String(d.display_name||'').trim(),role:d.role,church_id:d.church_id,network_id:d.network_id||null};
   const adminHeaders={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
   const args={p_actor:actor.id,p_auth_user:null,p_data:profile,p_check_only:true};
   const preflight=await fetch(base+'/rest/v1/rpc/videira_account_provision',{method:'POST',headers:adminHeaders,body:JSON.stringify(args)});
   if(!preflight.ok){const fail=await preflight.json();return reply({error:String(fail.message||'Confira os dados e vínculos.').slice(0,200)},400)}
   // Admin create_user does not send invitation or recovery emails.
   const created=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers:adminHeaders,body:JSON.stringify({email,password,email_confirm:true})});
   const account=await created.json();
   if(!created.ok||!account.id)return reply({error:'Não foi possível criar o acesso. Confira se o e-mail já está em uso e se a senha atende à política do projeto.'},400);
   let provisioned;
   try{provisioned=await fetch(base+'/rest/v1/rpc/videira_account_provision',{method:'POST',headers:adminHeaders,body:JSON.stringify({...args,p_auth_user:account.id,p_check_only:false})})}catch{return reply({error:'A autenticação foi criada, mas o vínculo não pôde ser confirmado. Não repita o cadastro; solicite a conferência administrativa no Supabase.'},503)}
   if(!provisioned.ok){
    const failure=await provisioned.json();
    // Compensate only the new, unlinked Auth identity from this request.
    const undone=await fetch(base+'/auth/v1/admin/users/'+encodeURIComponent(account.id),{method:'DELETE',headers:adminHeaders});
    return reply({error:undone.ok?String(failure.message||'Não foi possível vincular esta conta.').slice(0,200):'A autenticação foi criada sem vínculo confirmado. Solicite a conferência administrativa no Supabase antes de tentar novamente.'},400);
   }
   return reply(await provisioned.json());
  }
  if(body.action==='logout'){
   await fetch(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+token}});return reply({ok:true});
  }
  if(!['load','church','network','cell','person','meeting'].includes(body.action))return reply({error:'Operação inválida'},400);
  const result=await fetch(base+'/rest/v1/rpc/videira_portal',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_action:body.action,p_data:body.data||{}})});
  const data=await result.json();
  if(!result.ok)return reply({error:data.code==='42501'?'Você não tem permissão para esta operação.':data.code==='23503'?'Confira os vínculos entre igreja, rede e célula.':data.code==='23505'?'Este registro já existe.':String(data.message||'Não foi possível salvar').slice(0,200)},400);
  return reply(data);
 }catch{return reply({error:'Não foi possível concluir. Tente novamente.'},500)}
});
