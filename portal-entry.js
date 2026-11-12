'use strict';
// Production access and the sample dashboard remain separate.
document.querySelector('#loginBtn').onclick=()=>{location.href='gestao.html?v=20261112-profile-return'};
const demoButton=document.createElement('button');demoButton.type='button';demoButton.className='dash-button';demoButton.textContent='Explorar demonstração';demoButton.onclick=()=>openLogin();document.querySelector('footer .toolbar').append(demoButton);

(()=>{
 const button=document.querySelector('#loginBtn');
 const config=window.VIDEIRA_CONFIG;
 const key='videira:gestao:session:v1';
 const roles={
  master:'Master',supervisor:'Pastor Supervisor',predio:'Pastor de Prédio',
  pastor:'Pastor de Rede',obreiro:'Obreiro',discipulador:'Discipulador',lider:'Líder de célula'
 };
 let revision=0;
 const read=store=>{
  try{
   const value=JSON.parse(store.getItem(key));
   return value?.access_token&&value?.refresh_token?value:null;
  }catch{return null}
 };
 const current=()=>{
  for(const store of [sessionStorage,localStorage]){
   const tokens=read(store);
   if(tokens)return {store,tokens};
  }
  return null;
 };
 function showLogin(){
  button.classList.remove('login-account');
  button.removeAttribute('aria-label');
  button.textContent='Login ↗';
 }
 function showProfile(profile){
  const name=profile.display_name.trim();
  if(!name)return;
  const avatar=document.createElement('span');
  avatar.className='login-avatar';
  avatar.setAttribute('aria-hidden','true');
  avatar.textContent=name.split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]).join('').toUpperCase();
  const photo=profile.photo_url;
  if(typeof photo==='string'&&photo.startsWith(config.url+'/storage/v1/object/sign/videira-avatars/')){
   const image=new Image();
   image.alt='';
   image.onload=()=>avatar.replaceChildren(image);
   image.src=photo;
  }
  const role=roles[profile.role]||'Gestão';
  const info=document.createElement('span');
  info.className='login-account-info';
  const title=document.createElement('strong');
  title.textContent=name;
  const subtitle=document.createElement('small');
  subtitle.textContent=role;
  info.append(title,subtitle);
  button.classList.add('login-account');
  button.setAttribute('aria-label',name+', '+role+'. Abrir painel de gestão');
  button.replaceChildren(avatar,info);
 }
 function request(action,tokens){
  const refresh=action==='refresh';
  return fetch(config.gateway,{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:config.publicKey,Authorization:'Bearer '+config.publicKey,
    'X-Videira-Session':refresh?'':tokens.access_token},
   body:JSON.stringify(refresh?{action,data:{refresh_token:tokens.refresh_token}}:{action}),
   signal:AbortSignal.timeout(10000)
  });
 }
 async function renew({store,tokens}){
  const refresh=async()=>{
   const saved=read(store);
   if(!saved||saved.local_id!==tokens.local_id)return null;
   if(saved.access_token!==tokens.access_token)return saved;
   const response=await request('refresh',saved);
   if(!response.ok)return null;
   const next=await response.json();
   if(!next.access_token||!next.refresh_token||read(store)?.local_id!==saved.local_id)return null;
   const renewed={...next,local_id:saved.local_id,expires_at:Date.now()+Number(next.expires_in||3600)*1000};
   store.setItem(key,JSON.stringify(renewed));
   return renewed;
  };
  return store===localStorage&&navigator.locks?navigator.locks.request(key,refresh):refresh();
 }
 async function sync(){
  const version=++revision;
  const session=current();
  if(!session){showLogin();return}
  try{
   let response=await request('profile_get',session.tokens);
   if(response.status===401&&version===revision){
    const renewed=await renew(session);
    if(renewed)response=await request('profile_get',renewed);
   }
   if(version!==revision||current()?.tokens.local_id!==session.tokens.local_id)return;
   if(!response.ok){showLogin();return}
   const profile=await response.json();
   if(version===revision&&typeof profile.display_name==='string')showProfile(profile);
  }catch{
   if(version===revision)showLogin();
  }
 }
 if(!config)return;
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null)sync()});
 window.addEventListener('pageshow',event=>{if(event.persisted)sync()});
 sync();
})();
