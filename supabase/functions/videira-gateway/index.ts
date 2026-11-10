// The browser receives no service key and no username/email mapping.
const base = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins = new Set(['https://shockof.github.io','http://127.0.0.1:8765','http://localhost:8765']);
// Only public Google Maps URLs may be resolved. No arbitrary URL proxy.
function checkedMapsUrl(value:string){const u=new URL(value);const h=u.hostname.toLowerCase();const allowed=['google.com','www.google.com','maps.google.com','google.com.br','www.google.com.br','maps.google.com.br','maps.app.goo.gl','goo.gl'];if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed.includes(h)||value.length>4096)throw Error('Use um link HTTPS do Google Maps.');if(h==='goo.gl'&&!u.pathname.startsWith('/maps/'))throw Error('Link do Google Maps inválido.');if(!['maps.app.goo.gl','goo.gl'].includes(h)&&!u.pathname.startsWith('/maps')&&!(h.startsWith('maps.')&&u.pathname==='/'))throw Error('Use um link de localização do Google Maps.');return u}
function mapsFields(u:URL){
 const dec=(s:string)=>{try{return decodeURIComponent(s.replace(/\+/g,' '))}catch{return s}};
 const query=u.searchParams.get('query')||u.searchParams.get('q')||'',path=dec(u.pathname.match(/\/place\/([^/]+)/)?.[1]||'');
 const point=dec(u.href).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)||query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
 const coordinate=point&&Number.isFinite(+point[1])&&Number.isFinite(+point[2])&&Math.abs(+point[1])<=90&&Math.abs(+point[2])<=180?{latitude:+point[1],longitude:+point[2]}:null;
 const text=path||query;let street='';if(/^(?:Rua\b|R\.\s|Avenida\b|Av\.\s|Travessa\b|Trav\.\s|Alameda\b|Estrada\b|Rodovia\b|Pra[çc]a\b|Largo\b|Viela\b)/i.test(text.trim()))street=text.split(',')[0].split(/\s+-\s+/)[0].replace(/\s+n[ºo°.]\s*\d+.*$/i,'').trim().slice(0,180);
 return {coordinate,street,query:text};
}
async function resolveMapsLink(value:string){
 let u=checkedMapsUrl(value);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  for(let n=0;['maps.app.goo.gl','goo.gl'].includes(u.hostname)||n>0;n++){
   if(n>=5)throw Error('O link teve redirecionamentos demais. Copie o link completo do Maps.');
   const response=await fetch(u.href,{redirect:'manual',signal:controller.signal,headers:{'User-Agent':'VideiraCellLocation/1.0','Accept':'text/html'}});const location=response.headers.get('location');await response.body?.cancel();if(response.status>=300&&response.status<400&&location){u=checkedMapsUrl(new URL(location,u).href);if(!['maps.app.goo.gl','goo.gl'].includes(u.hostname))break}else break;
  }
  if(['maps.app.goo.gl','goo.gl'].includes(u.hostname))throw Error('Não foi possível abrir este link curto. Copie o link completo do navegador.');
  const parsed=mapsFields(u);const result:Record<string,unknown>={maps_url:value,street:parsed.street,house_number:'',...(parsed.coordinate||{})};
  const key=Deno.env.get('GOOGLE_MAPS_API_KEY');
  if(key&&(parsed.coordinate||parsed.street)){
   const url=new URL('https://maps.googleapis.com/maps/api/geocode/json');url.searchParams.set('key',key);url.searchParams.set('language','pt-BR');if(parsed.coordinate)url.searchParams.set('latlng',parsed.coordinate.latitude+','+parsed.coordinate.longitude);else url.searchParams.set('address',parsed.query);
   const response=await fetch(url,{signal:controller.signal});const json=await response.json();if(response.ok&&json.status==='OK'&&json.results?.length){const entry=json.results[0],components=entry.address_components||[],part=(type:string,short=false)=>{const c=components.find((x:any)=>x.types.includes(type));return c?.[short?'short_name':'long_name']||''};result.street=part('route')||result.street;result.postal_code=part('postal_code').replace(/\D/g,'');result.neighborhood=part('sublocality_level_1')||part('neighborhood');result.city=part('administrative_area_level_2')||part('locality');result.state=part('administrative_area_level_1',true);if(!parsed.coordinate&&entry.geometry?.location){result.latitude=entry.geometry.location.lat;result.longitude=entry.geometry.location.lng}}
  }
  result.street_available=Boolean(result.street);result.geocoding_configured=Boolean(key);return result;
 }finally{clearTimeout(timer)}
}

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
  if(['account_get','account_save','account_reset_password','resolve_maps'].includes(body.action)){
   const actor=await checked.json(),d=body.data||{},userHeaders={apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json'};
   if(body.action==='resolve_maps'){
    const scope=await fetch(base+'/rest/v1/rpc/videira_portal',{method:'POST',headers:userHeaders,body:JSON.stringify({p_action:'load'})});if(!scope.ok)return reply({error:'Acesso indisponível'},403);const context=await scope.json();if(!['master','supervisor','predio'].includes(context.profile?.role)||!context.profile?.active)return reply({error:'Sem permissão para editar células'},403);
    try{return reply(await resolveMapsLink(String(d.url||'')))}catch(error){const message=error instanceof Error?error.message:'';const known=['Use um link HTTPS do Google Maps.','Link do Google Maps inválido.','Use um link de localização do Google Maps.','O link teve redirecionamentos demais. Copie o link completo do Maps.','Não foi possível abrir este link curto. Copie o link completo do navegador.'];return reply({error:known.includes(message)?message:'Não foi possível importar o link. Copie o endereço completo do Google Maps e tente novamente.'},400)}
   }
   const operation=body.action==='account_save'?'save':body.action==='account_reset_password'?'password_check':'get';
   const clean=operation==='save'?{id:d.id,display_name:d.display_name,username:d.username,role:d.role,church_id:d.church_id,network_id:d.network_id,active:d.active,phone:d.phone,contact_email:d.contact_email}:{id:d.id};
   const response=await fetch(base+'/rest/v1/rpc/videira_admin_account',{method:'POST',headers:userHeaders,body:JSON.stringify({p_action:operation,p_data:clean})});const target=await response.json();
   if(!response.ok)return reply({error:String(target.message||'Conta indisponível').slice(0,220)},response.status===403?403:400);
   if(body.action!=='account_reset_password')return reply(target);
   const password=String(d.new_password||''),current=String(d.master_password||'');if(password.length<12||password.length>128||!current||current.length>1024)return reply({error:'Informe sua senha Master e uma nova senha de 12 a 128 caracteres.'},400);
   const limit=await fetch(base+'/rest/v1/rpc/videira_admin_reset_limit',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p_actor:actor.id})});if(!limit.ok||await limit.json()!==true)return reply({error:'Limite de tentativas de redefinição atingido. Aguarde 15 minutos.'},429);
   const verified=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:secret,'Content-Type':'application/json'},body:JSON.stringify({email:actor.email,password:current})});const proof=await verified.json();if(!verified.ok||proof.user?.id!==actor.id)return reply({error:'Não foi possível confirmar sua senha Master.'},400);
   await fetch(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+proof.access_token}});
   const updated=await fetch(base+'/auth/v1/admin/users/'+encodeURIComponent(target.id),{method:'PUT',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({password})});
   if(!updated.ok)return reply({error:'Não foi possível redefinir a senha. Confira a política de senha do projeto.'},400);
   await fetch(base+'/rest/v1/rpc/videira_admin_password_event',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p_actor:actor.id,p_target:target.id})});return reply({ok:true});
  }
  if(['profile_get','profile_save','change_password'].includes(body.action)){
   const actor=await checked.json(),d=body.data||{};
   const userHeaders={apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json'};
   const profileRpc=async(action:string,data:unknown={})=>fetch(base+'/rest/v1/rpc/videira_my_profile',{method:'POST',headers:userHeaders,body:JSON.stringify({p_action:action,p_data:data})});
   const prior=await profileRpc('get');if(!prior.ok)return reply({error:'Perfil indisponível'},403);const old=await prior.json();
   if(body.action==='change_password'){
    const password=String(d.new_password||''),current=String(d.current_password||'');
    if(!current||current.length>1024||password.length<12||password.length>128)return reply({error:'Informe sua senha atual e uma nova senha com 12 a 128 caracteres.'},400);
    const updated=await fetch(base+'/auth/v1/user',{method:'PUT',headers:userHeaders,body:JSON.stringify({password,current_password:current})});
    if(!updated.ok){const error=await updated.json();return reply({error:['reauthentication_needed','reauthentication_not_valid'].includes(error.error_code||error.code)?'Entre novamente e tente alterar sua senha.':'Não foi possível alterar. Confira a senha atual e use uma nova senha diferente, com pelo menos 12 caracteres.'},400)}
    await fetch(base+'/auth/v1/logout?scope=global',{method:'POST',headers:userHeaders});return reply({ok:true});
   }
   let profile=old,newPath:string|null=null;
   if(body.action==='profile_save'){
    const data:Record<string,unknown>={display_name:String(d.display_name||'').trim(),phone:String(d.phone||'').trim(),contact_email:String(d.contact_email||'').trim()};
    if(!data.display_name||String(data.display_name).length>180||String(data.phone).length>40||String(data.contact_email).length>254||data.contact_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.contact_email)))return reply({error:'Confira o nome, telefone e e-mail de contato.'},400);
    if(d.remove_photo===true)data.photo_path=null;
    if(d.photo_base64){
     const encoded=String(d.photo_base64);if(encoded.length>800000||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return reply({error:'Foto muito grande ou inválida.'},400);
     const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return reply({error:'Envie uma foto JPEG válida.'},400);
     newPath=actor.id+'/'+crypto.randomUUID()+'.jpg';
     const uploaded=await fetch(base+'/storage/v1/object/videira-avatars/'+newPath,{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'image/jpeg','x-upsert':'false'},body:bytes});
     if(!uploaded.ok)return reply({error:'Não foi possível carregar a foto. Tente novamente.'},400);data.photo_path=newPath;
    }
    const saved=await profileRpc('save',data);if(!saved.ok){if(newPath)await fetch(base+'/storage/v1/object/videira-avatars',{method:'DELETE',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[newPath]})});return reply({error:'Não foi possível salvar o perfil. Confira os dados.'},400)}
    profile=await saved.json();
    if(old.photo_path&&old.photo_path!==profile.photo_path)await fetch(base+'/storage/v1/object/videira-avatars',{method:'DELETE',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[old.photo_path]})});
   }
   profile.photo_url=null;
   if(profile.photo_path){const signed=await fetch(base+'/storage/v1/object/sign/videira-avatars/'+profile.photo_path,{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600})});if(signed.ok){const link=await signed.json();if(String(link.signedURL||'').startsWith('/object/sign/'))profile.photo_url=base+'/storage/v1'+link.signedURL;}}
   delete profile.photo_path;return reply(profile);
  }
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
  if(!['load','church','network','cell','person','meeting','meeting_archive'].includes(body.action))return reply({error:'Operação inválida'},400);
  const result=await fetch(base+'/rest/v1/rpc/videira_portal',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_action:body.action,p_data:body.data||{}})});
  const data=await result.json();
  if(!result.ok)return reply({error:data.code==='42501'?'Você não tem permissão para esta operação.':data.code==='23503'?'Confira os vínculos entre igreja, rede e célula.':data.code==='23505'?'Este registro já existe.':String(data.message||'Não foi possível salvar').slice(0,200)},400);
  return reply(data);
 }catch{return reply({error:'Não foi possível concluir. Tente novamente.'},500)}
});
