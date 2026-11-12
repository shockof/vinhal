'use strict';
(()=>{
const cfg=window.VIDEIRA_CONFIG,$=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roles={master:'Master',supervisor:'Pastor (a) Supervisor (a)',predio:'Pastor (a) de prédio',pastor:'Pastor (a) de rede',obreiro:'Obreiro (a)',discipulador:'Discipulador (a)',lider:'Líder de célula'};
let session=null,db=null,view='overview',edit=null,busy=false,accountRoleFilter='',accountChurchFilter='',ownProfile=null;
const names={overview:'Visão geral',profile:'Meu perfil',church:'Igrejas',network:'Redes',cell:'Células',person:'Membros e visitantes',meeting:'Presenças',reports:'Relatórios Excel',site:'Editar site',accounts:'Contas e liderança'};
const memberTransferRoles=new Set(['master','supervisor','pastor','obreiro','predio']);
const list={church:'churches',network:'networks',cell:'cells',person:'people'};
const label=(items,id,field='name')=>items.find(x=>x.id===id)?.[field]||'—';
const field=(name,title,value='',type='text',extra='')=>`<label>${title}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select=(name,title,items,value='',key='name',optional=false)=>`<label>${title}<select name="${name}" ${optional?'':'required'}>${optional?'<option value="">'+esc(typeof optional==='string'?optional:'A definir')+'</option>':'<option value="">Selecione</option>'}${items.map(x=>`<option value="${esc(x.id)}" ${x.id===value?'selected':''}>${esc(x[key])}</option>`).join('')}</select></label>`;
const status=(message,error=false)=>{const el=$('#status')||$('#message');if(el){el.textContent=message;el.classList.toggle('error',error)}};
const sessionKey='videira:gestao:session:v1';
let sessionStore=null;
let refreshPending=null;

function readSession(store){
 try{
  const saved=JSON.parse(store.getItem(sessionKey));
  return saved?.access_token&&saved?.refresh_token?saved:null;
 }catch{return null}
}

function storeSession(value){
 session=value;
 try{sessionStore?.setItem(sessionKey,JSON.stringify(value))}catch{}
}

function clearSession(){
 session=null;
 db=null;
 ownProfile=null;
 for(const store of [sessionStorage,localStorage]){
  try{store.removeItem(sessionKey)}catch{}
 }
}

async function request(action,data,token){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch(cfg.gateway,{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:cfg.publicKey,
    Authorization:'Bearer '+cfg.publicKey,'X-Videira-Session':token||''},
   body:JSON.stringify(action==='login'?{action,...data}:{action,data}),
   signal:controller.signal
  });
  const result=await response.json();
  if(!response.ok){
   const failure=Error(result.error||'Não foi possível concluir esta operação.');
   failure.status=response.status;
   if(action==='create_account'&&response.status>=500)failure.uncertain=true;
   throw failure;
  }
  return result;
 }catch(error){
  if(error.name==='AbortError'){
   const failure=Error('O servidor demorou para responder. Confira a conexão e tente novamente.');
   if(action==='create_account')failure.uncertain=true;
   throw failure;
  }
  if(action==='create_account'&&error instanceof TypeError)error.uncertain=true;
  throw error;
 }finally{clearTimeout(timer)}
}

function saveTokens(tokens){
 storeSession({...tokens,local_id:session?.local_id||crypto.randomUUID(),expires_at:Date.now()+Number(tokens.expires_in||3600)*1000});
}

async function refreshSession(previousToken){
 if(refreshPending)return refreshPending;
 const localId=session?.local_id;
 const refresh=async()=>{
  if(sessionStore===localStorage){
   const latest=readSession(localStorage);
   if(!latest||latest.local_id!==localId)throw Object.assign(Error('Sessão encerrada. Entre novamente.'),{status:401});
   session=latest;
  }
  if(session?.access_token!==previousToken&&session?.expires_at>Date.now()+30000)return;
  const tokens=await request('refresh',{refresh_token:session?.refresh_token});
  if(sessionStore===localStorage&&readSession(localStorage)?.local_id!==localId)
   throw Object.assign(Error('Sessão encerrada. Entre novamente.'),{status:401});
  saveTokens(tokens);
 };
 refreshPending=(sessionStore===localStorage&&navigator.locks
  ?navigator.locks.request(sessionKey,refresh):refresh()).finally(()=>{refreshPending=null});
 return refreshPending;
}

async function call(action,data){
 if(action==='login')return request(action,data);
 try{
  if(session?.expires_at<=Date.now()+30000)await refreshSession(session.access_token);
  const token=session?.access_token;
  try{return await request(action,data,token)}catch(error){
   if(error.status!==401||!session?.refresh_token)throw error;
   await refreshSession(token);
   return await request(action,data,session.access_token);
  }
 }catch(error){
  if(error.status===401){
   const current=readSession(sessionStore);
   if(!current||current.local_id===session?.local_id)clearSession();
   if($('#logout'))location.reload();
  }
  throw error;
 }
}

async function reload(){db=await call('load');if(!db?.profile?.active)throw Error('Conta sem acesso ativo.');try{ownProfile=await call('profile_get')}catch{ownProfile=null}}
function table(headers,rows){return rows.length?`<div class="table-scroll"><table><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhum cadastro neste escopo.</div>'}
function metric(n,title){return `<article class="card"><strong>${n}</strong><span>${title}</span></article>`}
function overview(){return window.VideiraDashboard.overview(db)}
function entityForm(){const item=edit?db[list[view]].find(x=>x.id===edit):{};if(!item)return '';let fields='';
 if(view==='church')fields=field('name','Nome da igreja',item.name,'text','required maxlength="180"')+field('municipality','Município',item.municipality,'text','required maxlength="180"');
 if(view==='network')fields=field('name','Nome da rede',item.name,'text','required maxlength="180"')+select('church_id','Igreja',db.churches,item.church_id)+`<label>Tipo<select name="kind"><option value="regular">Rede regular</option><option value="kids" ${item.kind==='kids'?'selected':''}>Rede Kids</option></select></label>`;
 if(view==='cell')fields=field('name','Nome da célula',item.name,'text','required maxlength="180"')+select('church_id','Igreja',db.churches,item.church_id)+select('network_id','Rede',db.networks,item.network_id)+window.VideiraWeekly.fields(item)+window.VideiraLocation.fields(item)+select('leader_id','Líder',db.profiles.filter(x=>x.active&&['lider','discipulador','master','supervisor','predio'].includes(x.role)),item.leader_id,'display_name',true)+select('discipler_id','Discipulador (a)',db.profiles.filter(x=>x.active&&x.role==='discipulador'),item.discipler_id,'display_name',true);
 if(view==='person')fields=(edit?`
  <div class="profile-photo-row wide">
   <div id="memberPhotoPreview" class="profile-avatar"><span aria-label="Sem foto">—</span></div>
   <div>
    <label>Foto do membro<input id="memberPhotoFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <small>JPG, PNG ou WebP · até 8 MB</small>
    <p id="memberPhotoFeedback" role="status"></p>
   </div>
  </div>`:'')+field('full_name','Nome completo',item.full_name,'text','required maxlength="180"')+(!edit||memberTransferRoles.has(db.profile.role)
  ?select('cell_id','Célula',db.cells,item.cell_id)
  :`<label>Célula<input value="${esc(label(db.cells,item.cell_id))}" readonly></label>`)+field('phone','Telefone (opcional)',item.phone,'tel','maxlength="40"')+field('birth_date','Data de nascimento (opcional)',item.birth_date,'date','autocomplete="bday"')+`<label>Categoria<select name="category"><option value="Visitante">Visitante</option><option value="Membro" ${item.category==='Membro'?'selected':''}>Membro</option></select></label><label>Batismo<select name="baptized">${['Não informado','Sim','Não'].map(v=>`<option ${item.baptized===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Estado civil<select name="marital_status">${['Não informado','Solteiro(a)','Casado(a)','Divorciado(a)','Viúvo(a)'].map(v=>`<option ${item.marital_status===v?'selected':''}>${v}</option>`).join('')}</select></label>`;
 return `<article class="panel"><h2>${edit?'Editar cadastro':'Novo cadastro'}</h2><form id="entityForm" class="gridform">${fields}<div class="wide actions"><button>Salvar no Supabase</button>${edit?'<button type="button" class="secondary" id="cancelEdit">Cancelar edição</button>':''}</div></form>${view==='person'?'<p><small>Três encontros consecutivos com presença convertem o visitante em membro. Faltas interrompem a sequência.</small></p>':''}</article>`;
}
function entityList(){const headers=view==='church'?['Igreja','Município','']:view==='network'?['Rede','Igreja','Tipo','']:view==='cell'?['Célula','Rede','Encontro','']:['Nome','Categoria','Célula',''];return `<article class="panel">${table(headers,db[list[view]].map(x=>[...(view==='church'?[esc(x.name),esc(x.municipality)]:view==='network'?[esc(x.name),esc(label(db.churches,x.church_id)),x.kind==='kids'?'Kids':'Regular']:view==='cell'?[esc(x.name),esc(label(db.networks,x.network_id)),esc(x.meeting_schedule)]:[esc(x.full_name),esc(x.category),esc(label(db.cells,x.cell_id))]),`<button class="secondary" data-edit="${x.id}">Editar</button>`]))}</article>`}
function meetingCells(){return ['master','supervisor','predio'].includes(db.profile.role)?db.cells.filter(c=>c.leader_id===db.profile.id):db.cells}
function meeting(){const cells=meetingCells();return `<section class="meeting-picker"><h2>Escolha a célula para fazer a chamada</h2><p>Cada cartão mostra o dia e horário semanal cadastrados.</p>${['master','supervisor','predio'].includes(db.profile.role)?'<div class="notice">Aqui aparecem as células vinculadas a você como líder.</div>':''}<div class="meeting-cell-grid">${cells.map(c=>`<button type="button" class="meeting-cell-card" data-meeting-cell="${esc(c.id)}" aria-pressed="false" aria-controls="meetingEntry"><svg class="meeting-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h3m2 0h3"/></svg><strong>${esc(c.name)}</strong><span class="meeting-card-schedule">${esc(c.meeting_schedule||'Dia e horário ainda não informados')}</span><small>${db.people.filter(p=>p.cell_id===c.id).length} pessoa(s) cadastrada(s)</small><span class="meeting-card-action">Fazer chamada →</span></button>`).join('')||'<div class="empty">Nenhuma célula disponível para sua chamada. Confira o vínculo do líder no cadastro da célula.</div>'}</div></section><article class="panel meeting-entry" id="meetingEntry" hidden><div class="meeting-entry-heading"><div><small>CHAMADA DA CÉLULA</small><h2 id="meetingCellTitle"></h2><p id="meetingCellSchedule"></p></div><button type="button" class="secondary" id="closeMeeting">Voltar às células</button></div><p>Confira os participantes e salve a chamada após o encontro. A data não pode ser futura, repetir ou preceder o último encontro registrado.</p><form id="meetingForm"><input type="hidden" name="cell_id"><div class="meeting-today"><span>Data do encontro: <strong id="meetingDateDisplay"></strong></span><details id="changeMeetingDate"><summary>Alterar data</summary>${field('date','Data do encontro','','date','required')}</details></div><p id="meetingDateHelp" class="notice" role="status"></p><div id="attendance" style="margin-top:20px"></div><div class="actions"><button id="saveMeeting">Salvar presenças</button><button type="button" class="secondary" id="markAll">Marcar todos</button></div></form></article>${callHistory()}`}
function callHistory(){if(!['master','supervisor','predio','pastor','obreiro'].includes(db.profile.role))return '';const rows=(items,removed)=>table(['Data','Célula','Ações'],items.slice().sort((a,b)=>b.meeting_date.localeCompare(a.meeting_date)).map(m=>[esc(m.meeting_date.split('-').reverse().join('/')),esc(label(db.cells,m.cell_id)),`<button type="button" class="secondary" data-call-archive="${esc(m.id)}" data-restore="${removed}">${removed?'Restaurar':'Excluir chamada'}</button>`]));return `<article class="panel"><h2>Chamadas salvas</h2><p>Somente as células sob sua gestão. Chamadas excluídas saem dos relatórios e podem ser restauradas. A categoria atual dos membros é preservada.</p>${rows(db.meetings,false)}<details class="archived-calls"><summary>Chamadas excluídas (${(db.archived_meetings||[]).length})</summary>${rows(db.archived_meetings||[],true)}</details></article>`}
function report(){return `<article class="panel"><h2>Relatório do seu escopo</h2><p>Participação por período e categorias atuais. A frequência usa presenças divididas pelos registros de presença e ausência.</p><div class="report-filters">${select('filterChurch','Igreja',db.churches,'','name','Todas as igrejas')}${select('filterNetwork','Rede',db.networks,'','name','Todas as redes')}${field('from','Data inicial','','date')}${field('to','Data final','','date')}</div><div id="reportVisuals" class="dashboard"></div><div id="reportTable"></div><div class="actions"><button id="downloadExcel">Baixar Excel</button></div></article>`}
function reportRows(){const church=$('[name=filterChurch]').value,net=$('[name=filterNetwork]').value,from=$('[name=from]').value,to=$('[name=to]').value;if(from&&to&&from>to)throw Error('A data inicial deve ser anterior à data final.');return db.churches.filter(c=>!church||c.id===church).map(c=>{const cells=db.cells.filter(x=>x.church_id===c.id&&(!net||x.network_id===net)),ids=new Set(cells.map(x=>x.id)),people=db.people.filter(x=>ids.has(x.cell_id)),meetings=new Set(db.meetings.filter(m=>ids.has(m.cell_id)&&(!from||m.meeting_date>=from)&&(!to||m.meeting_date<=to)).map(m=>m.id)),att=db.attendance.filter(a=>meetings.has(a.meeting_id));return[c.name,c.municipality,cells.length,people.length,people.filter(x=>x.category==='Membro').length,people.filter(x=>x.category==='Visitante').length,att.filter(a=>a.present).length,att.length]})}
const accountRoleOrder={master:0,supervisor:1,predio:2,pastor:3,obreiro:3,discipulador:4,lider:5};
const accountNameOrder=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
function linkedProfiles(){return db.profiles.filter(p=>(!accountRoleFilter||p.role===accountRoleFilter)&&(!accountChurchFilter||(accountChurchFilter==='__global__'?['master','supervisor'].includes(p.role):p.church_id===accountChurchFilter))).sort((a,b)=>(accountRoleOrder[a.role]??99)-(accountRoleOrder[b.role]??99)||accountNameOrder.compare(a.display_name,b.display_name)||accountNameOrder.compare(a.username,b.username))}
function linkedAccountTable(){const profiles=linkedProfiles(),master=db.profile.role==='master',headers=['Nome','Usuário','Função','Igreja / rede','Estado'];if(master)headers.push('Ações');return profiles.length?table(headers,profiles.map(p=>{const row=[esc(p.display_name),esc(p.username),roles[p.role],['master','supervisor'].includes(p.role)?'Todas as igrejas e redes':esc(label(db.churches,p.church_id))+' / '+(p.role==='predio'||p.role==='obreiro'&&!p.network_id?'Todas as redes':esc(label(db.networks,p.network_id))),p.active?'Ativo':'Desativado'];if(master)row.push(`<button type="button" class="secondary" data-account-edit="${p.id}">Editar conta</button>`);return row})):'<div class="empty">'+(accountRoleFilter||accountChurchFilter?'Nenhuma conta com estes filtros.':'Nenhum cadastro neste escopo.')+'</div>'}
function linkedAccountCount(){const n=linkedProfiles().length;return n+' de '+db.profiles.length+' '+(db.profiles.length===1?'conta':'contas')}
function accounts(){const master=db.profile.role==='master';return `${master?`<article class="panel"><h2>Cadastrar acesso da liderança</h2><p>Crie o acesso e depois vincule o líder ou discipulador à célula correspondente na aba Células.</p>${`<form id="accountForm" class="gridform">${field('display_name','Nome completo','','text','required maxlength="180" autocomplete="name"')}${field('username','Nome de usuário','','text','required minlength="3" maxlength="50" pattern="[a-z0-9][a-z0-9._-]{2,49}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ex.: maria.silva"')}${field('birth_date','Data de nascimento (opcional)','','date','autocomplete="bday"')}${field('email','E-mail (opcional)','','email','maxlength="254" autocomplete="off"')}<label>Função<select name="role" required><option value="lider">Líder de célula</option><option value="master">Master</option><option value="supervisor">Pastor (a) Supervisor (a)</option><option value="discipulador">Discipulador (a)</option><option value="predio">Pastor (a) de prédio</option><option value="pastor">Pastor (a) de rede</option><option value="obreiro">Obreiro (a)</option></select></label>${select('church_id','Igreja',db.churches)}<label>Rede<select name="network_id" required><option value="">Selecione a igreja primeiro</option></select></label>${field('password','Senha inicial','','password','required minlength="12" maxlength="128" autocomplete="new-password"')}${field('confirm_password','Confirme a senha inicial','','password','required minlength="12" maxlength="128" autocomplete="new-password"')}<div class="notice wide">A senha inicial precisa ter de 12 a 128 caracteres. Entregue o usuário e a senha à pessoa por um meio privado. O e-mail é opcional: o acesso funciona com usuário e senha. Este cadastro não envia e-mail automaticamente. O e-mail não será exibido na lista de liderança nem no site público.</div><div class="notice wide" id="accountScope"></div><div class="wide actions"><button>Criar cadastro e acesso</button></div></form>`}</article>`:''}<article class="panel"><div class="account-list-toolbar"><div><h2>Contas vinculadas</h2><small id="accountCount" aria-live="polite">${linkedAccountCount()}</small></div><div class="account-list-filters"><label>Filtrar por função<select id="accountRoleFilter"><option value="">Todas as funções</option>${['master','supervisor','predio','pastor','obreiro','discipulador','lider'].map(role=>`<option value="${role}" ${accountRoleFilter===role?'selected':''}>${roles[role]}</option>`).join('')}</select></label><label>Filtrar por igreja<select id="accountChurchFilter"><option value="">Todas as igrejas</option><option value="__global__" ${accountChurchFilter==='__global__'?'selected':''}>Acesso a todas (Master/Supervisor)</option>${db.churches.slice().sort((a,b)=>accountNameOrder.compare(a.name,b.name)).map(c=>`<option value="${c.id}" ${accountChurchFilter===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div></div><p class="account-order-note">Master · Pastor Supervisor · Pastor de prédio · Pastores de rede / Obreiros · Discipuladores · Líderes</p><div id="linkedAccounts">${linkedAccountTable()}</div></article>`}

async function loadBirthdays(panel) {
 try {
  const {month,entries}=await call('birthdays');
  if(!panel.isConnected)return;
  const monthName=new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'})
   .format(new Date(Date.UTC(2000,month-1,1)));
  const cards=entries.map(person=>{
   const date=String(person.day).padStart(2,'0')+'/'+String(month).padStart(2,'0');
   return `<li class="birthday-card">
    <span class="attendance-avatar birthday-avatar" aria-hidden="true"${person.member_photo_id?` data-person-photo="${esc(person.member_photo_id)}"`:''}${person.photo_url?` data-photo-url="${esc(person.photo_url)}"`:''}>
     ${esc(personInitials(person.name))}
    </span>
    <div><strong>${esc(person.name)}</strong><span>${esc(person.group_name||roles[person.kind]||person.kind)}</span></div>
    <span class="birthday-date">${date}</span>
   </li>`;
  });
  panel.innerHTML=`<h2>Aniversariantes de ${esc(monthName)}</h2>`+
   (cards.length?`<ul class="birthday-grid">${cards.join('')}</ul>`:
    '<p>Nenhum aniversário cadastrado neste mês no seu escopo.</p>');
  loadPersonPhotos(panel);
 } catch(error) {
  if(panel.isConnected)panel.querySelector('[role=status]').textContent=error.message||'Não foi possível carregar os aniversariantes.';
 }
}

function render(){const tabs=['overview','profile',...(['master','supervisor'].includes(db.profile.role)?['church','network','cell']:db.profile.role==='predio'?['network','cell']:[]),'person','meeting','reports','accounts',...(db.profile.role==='master'?['site']:[])];$('#app').innerHTML=`<div class="shell"><aside><img src="assets/logo.png" alt="Videira"><nav aria-label="Gestão">${tabs.map(v=>`<button data-view="${v}" class="${view===v?'active':''}">${names[v]}</button>`).join('')}</nav><div class="identity"><div>${ownProfile?.photo_url?`<img class="identity-avatar" src="${esc(ownProfile.photo_url)}" alt="Sua foto">`:''}${esc(db.profile.display_name)}<small>${roles[db.profile.role]} · ${esc(db.profile.username)}</small></div><button class="secondary" id="logout">Sair</button></div></aside><main class="main ${view==='overview'?'dashboard-main':''}"><div class="top"><span class="badge">Conectado ao Supabase · Dados reais</span><a href="index.html">Ver site ↗</a></div>${view==='overview'?'':`<div class="heading"><small>IGREJA VIDEIRA / GESTÃO</small><h1>${view==='overview'?window.VideiraDashboard.title(db.profile.role):names[view]}</h1><p>Somente os registros permitidos ao seu perfil.</p></div>`}<div id="status" role="status" aria-live="polite"></div><div id="workspace">${view==='overview'?overview():view==='site'?'<div id="siteEditor"></div>':view==='profile'?'<div id="myProfile"></div>':list[view]?entityForm()+entityList():view==='meeting'?meeting():view==='reports'?report():accounts()}</div><small>Gravação no servidor. Membros, telefones e presenças não são publicados no site.</small></main></div>`;bind();}
function bindMemberPhoto(form,id){
 const file=form.querySelector('#memberPhotoFile');
 const preview=form.querySelector('#memberPhotoPreview');
 const feedback=form.querySelector('#memberPhotoFeedback');
 const photo={processing:false,image:null};
 let selection=0;
 const show=(value,alt)=>{
  const img=document.createElement('img');
  img.src='data:image/jpeg;base64,'+value;
  img.alt=alt;
  preview.replaceChildren(img);
 };
 call('person_photo',{id}).then(({photo_base64})=>{
  if(form.isConnected&&selection===0&&photo_base64)show(photo_base64,'Foto atual do membro');
 }).catch(()=>{
  if(form.isConnected&&selection===0)feedback.textContent='Não foi possível carregar a foto atual.';
 });
 file.onchange=async()=>{
  const selected=file.files[0];
  if(!selected)return;
  const version=++selection;
  photo.processing=true;
  feedback.textContent='Preparando a foto…';
  try {
   const image=await window.VideiraProfile.preparePhoto(selected);
   if(version!==selection||!form.isConnected)return;
   photo.image=image;
   show(image,'Prévia da foto do membro');
   feedback.textContent='Salve o cadastro para confirmar a foto.';
  } catch(error) {
   if(version!==selection)return;
   feedback.textContent=error.message;
   file.value='';
  } finally {
   if(version===selection)photo.processing=false;
  }
 };
 return photo;
}

function personInitials(name){
 const parts=name.trim().split(/\s+/);
 return (Array.from(parts[0])[0]||'—').toUpperCase()+
  (parts.length>1?Array.from(parts.at(-1))[0].toUpperCase():'');
}

async function loadPersonPhotos(list){
 const avatars=[...list.querySelectorAll('[data-person-photo],[data-photo-url]')];
 let next=0;
 async function load(){
  while(next<avatars.length){
   const avatar=avatars[next++];
   if(!avatar.isConnected||list.closest('[hidden]'))return;
   try {
    let url=avatar.dataset.photoUrl;
    if(!url){
     const {photo_base64}=await call('person_photo',{id:avatar.dataset.personPhoto});
     if(!photo_base64||!avatar.isConnected)continue;
     url='data:image/jpeg;base64,'+photo_base64;
    }
    const image=document.createElement('img');
    image.alt='';
    image.onload=()=>{if(avatar.isConnected)avatar.replaceChildren(image)};
    image.src=url;
   } catch {
    // Keep the initials if the photo cannot be loaded.
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(4,avatars.length)},load));
}

function bind(){const bindViews=()=>document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;edit=null;render()});bindViews();
 if(view==='overview'){const filters=()=>({from:window.VideiraDashboard.startDate($('#dashboardPeriod').value),church:$('#dashboardChurch')?.value||''}),bindDashboard=()=>window.VideiraDashboard.bind($('#dashboardVisuals'),db,filters()),update=()=>{
  const birthdays=$('#birthdaysPanel');
  $('#dashboardVisuals').innerHTML=window.VideiraDashboard.visuals(db,filters(),true);
  $('#birthdaysPanel').replaceWith(birthdays);
  bindDashboard();bindViews();
 };bindDashboard();loadBirthdays($('#birthdaysPanel'));$('#dashboardPeriod').onchange=update;if($('#dashboardChurch'))$('#dashboardChurch').onchange=update}

 $('#logout').onclick=async()=>{try{await call('logout')}catch{}finally{clearSession();location.reload()}};document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{edit=b.dataset.edit;render();$('#workspace').scrollIntoView({behavior:'smooth'})});if($('#cancelEdit'))$('#cancelEdit').onclick=()=>{edit=null;render()};
 if(view==='site')window.VideiraSiteEditor.mount($('#siteEditor'),{call,profile:db.profile,config:cfg,getSession:()=>session});
 if(view==='profile')window.VideiraProfile.mount($('#myProfile'),{call,onSaved:async()=>{await reload();render();status('Perfil atualizado no Supabase.')},onPasswordChanged:()=>{clearSession();location.href='gestao.html?senha=alterada'}});
 const bindAccountEditors=()=>document.querySelectorAll('[data-account-edit]').forEach(button=>button.onclick=()=>window.VideiraAccountEditor.open({id:button.dataset.accountEdit,call,churches:db.churches,networks:db.networks,roles,selfId:db.profile.id,onSaved:async()=>{await reload();if($('#linkedAccounts'))updateAccountFilters();status('Conta atualizada no Supabase.')},onReset:()=>status('Senha da conta redefinida.')}));
 const updateAccountFilters=()=>{$('#linkedAccounts').innerHTML=linkedAccountTable();$('#accountCount').textContent=linkedAccountCount();bindAccountEditors()};
 bindAccountEditors();
 if($('#accountRoleFilter'))$('#accountRoleFilter').onchange=e=>{accountRoleFilter=e.target.value;updateAccountFilters()};
 if($('#accountChurchFilter'))$('#accountChurchFilter').onchange=e=>{accountChurchFilter=e.target.value;updateAccountFilters()};
 if($('#accountForm')){
  const form=$('#accountForm');
  const networks=()=>{const role=form.elements.role.value,global=['master','supervisor'].includes(role),old=form.elements.network_id.value,church=form.elements.church_id.value,building=role==='predio',optional=role==='obreiro'||building||global;form.elements.church_id.parentElement.hidden=global;form.elements.network_id.parentElement.hidden=global||building;form.elements.church_id.disabled=global;form.elements.church_id.required=!global;form.elements.network_id.disabled=global||building;form.elements.network_id.required=!optional;form.elements.network_id.innerHTML=`<option value="">${global?'Todas as redes':optional?'Toda a igreja':'Selecione a rede'}</option>`+(global?'':db.networks.filter(n=>n.church_id===church).map(n=>`<option value="${n.id}">${esc(n.name)}</option>`).join(''));if(!global&&db.networks.some(n=>n.id===old&&n.church_id===church))form.elements.network_id.value=old;$('#accountScope').textContent=role==='master'?'Master: acesso administrativo completo na organização, incluindo criação de contas.':role==='supervisor'?'Pastor (a) Supervisor (a): acompanha todas as igrejas, redes e células da organização. Não cria contas Master.':role==='predio'?'Pastor (a) de prédio: gere todas as redes e células da igreja selecionada.':role==='pastor'?'Pastor (a): acompanha as células da rede selecionada.':role==='obreiro'?'Obreiro (a): acompanha as células da igreja selecionada.':'Após criar o acesso, vincule esta pessoa como líder ou discipulador na aba Células. Até o vínculo, o painel ficará sem células.';};
  form.elements.church_id.onchange=networks;form.elements.role.onchange=networks;networks();
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;if(form.elements.password.value!==form.elements.confirm_password.value)return status('As senhas não coincidem.',true);const data=Object.fromEntries(new FormData(form));delete data.confirm_password;busy=true;form.querySelector('button').disabled=true;status('Criando cadastro e acesso no Supabase…');let created;
   try{created=await call('create_account',data);form.reset();await reload();render();status(`Acesso ${created.username} criado. Para líderes e discipuladores, confira o vínculo na aba Células.`)}catch(error){status(created?'O acesso foi criado, mas a lista não pôde ser atualizada. Recarregue e entre novamente antes de repetir o cadastro.':error.uncertain?'Não foi possível confirmar o resultado. Confira a lista e, se necessário, o Supabase antes de repetir o cadastro.':error.message,true);form.elements.password.value='';form.elements.confirm_password.value='';form.querySelector('button').disabled=false}finally{data.password='';busy=false}
  };
 }
 if($('#entityForm')){
  const form=$('#entityForm');
  if(edit){for(const name of (view==='cell'?['church_id','network_id']:view==='network'?['church_id']:[]))form.elements[name].disabled=true}
  if(view==='cell'){
   const links=()=>{const church=form.elements.church_id.value,network=form.elements.network_id.value;for(const [key,match] of [['leader_id',p=>['master','supervisor'].includes(p.role)||p.role==='predio'&&p.church_id===church||['lider','discipulador'].includes(p.role)&&p.church_id===church&&p.network_id===network],['discipler_id',p=>p.role==='discipulador'&&p.church_id===church&&p.network_id===network]]){const old=form.elements[key].value,choices=db.profiles.filter(p=>p.active&&match(p));form.elements[key].innerHTML='<option value="">A definir</option>'+choices.map(p=>`<option value="${p.id}">${esc(p.display_name)} · ${roles[p.role]}</option>`).join('');if(choices.some(p=>p.id===old))form.elements[key].value=old;}};
   if(!edit){const update=()=>{const church=form.elements.church_id.value;form.elements.network_id.innerHTML='<option value="">Selecione</option>'+db.networks.filter(x=>x.church_id===church).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');links()};form.elements.church_id.onchange=update;update()}
   form.elements.network_id.onchange=links;links();
  }
  const memberPhoto=view==='person'&&edit?bindMemberPhoto(form,edit):null;
  const locationControl=view==='cell'?window.VideiraLocation.bind(form,edit?db.cells.find(c=>c.id===edit):{}, {resolveMaps:url=>call('resolve_maps',{url})}):null;
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;if(locationControl){status('Conferindo localização…');await locationControl.wait();if(!form.isConnected||busy)return;}const data=Object.fromEntries(new FormData(form));if(edit)data.id=edit;if(memberPhoto){
   if(memberPhoto.processing)return status('Aguarde a preparação da foto.',true);
   data.original_cell_id=db.people.find(person=>person.id===edit).cell_id;
   if(memberPhoto.image)data.photo_base64=memberPhoto.image;
  }if(view==='cell'){try{data.meeting_schedule=window.VideiraWeekly.read(data,edit?db.cells.find(c=>c.id===edit)?.meeting_schedule:'')}catch(e){return status(e.message,true)}}if(view==='cell'&&Boolean(data.latitude)!==Boolean(data.longitude))return status('Informe latitude e longitude juntas.',true);if(locationControl){Object.assign(data,locationControl.read());for(const k of ['postal_code','street','house_number','complement','neighborhood','city','state','legacy_address'])delete data[k];}save(view,data)};
 }
 if($('#meetingForm')){const form=$('#meetingForm'),entry=$('#meetingEntry'),cards=[...document.querySelectorAll('[data-meeting-cell]')];
  const close=()=>{entry.hidden=true;form.reset();cards.forEach(b=>b.setAttribute('aria-pressed','false'))};
  cards.forEach(button=>button.onclick=()=>{const cell=meetingCells().find(c=>c.id===button.dataset.meetingCell);if(!cell||busy)return;form.reset();form.elements.cell_id.value=cell.id;const suggested=window.VideiraWeekly.suggest(cell.meeting_schedule||'',db.meetings.filter(m=>m.cell_id===cell.id));form.elements.date.value=suggested.date;$('#changeMeetingDate').open=false;const showDate=()=>{$('#meetingDateDisplay').textContent=form.elements.date.value.split('-').reverse().join('/')||'Selecione a data'};showDate();form.elements.date.onchange=showDate;form.elements.date.min=suggested.min;form.elements.date.max=suggested.max;form.elements.date.setAttribute('aria-describedby','meetingDateHelp');$('#meetingDateHelp').textContent=suggested.message;$('#meetingCellTitle').textContent=cell.name;$('#meetingCellSchedule').textContent=cell.meeting_schedule||'Dia e horário ainda não informados';const people=db.people.filter(p=>p.cell_id===cell.id);$('#attendance').innerHTML=people.map(p=>`<label class="check"><input type="checkbox" name="present" value="${esc(p.id)}"><span class="attendance-avatar" data-person-photo="${esc(p.id)}" aria-hidden="true">${esc(personInitials(p.full_name))}</span><span>${esc(p.full_name)} <small>· ${esc(p.category)}</small></span></label>`).join('')||'<p>Cadastre as pessoas desta célula antes de fazer a chamada.</p>';$('#saveMeeting').disabled=!people.length||Boolean(suggested.min&&suggested.date<suggested.min);$('#markAll').disabled=!people.length;cards.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));entry.hidden=false;loadPersonPhotos($('#attendance'));$('#meetingCellTitle').setAttribute('tabindex','-1');$('#meetingCellTitle').focus();entry.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})});
  $('#closeMeeting').onclick=()=>{if(busy)return;const selected=cards.find(b=>b.getAttribute('aria-pressed')==='true');close();selected?.focus()};
  $('#markAll').onclick=()=>form.querySelectorAll('[name=present]').forEach(x=>x.checked=true);
  form.onsubmit=e=>{e.preventDefault();if(busy)return;const id=form.elements.cell_id.value;if(!meetingCells().some(c=>c.id===id))return status('Selecione uma célula disponível para sua chamada.',true);const people=db.people.filter(p=>p.cell_id===id);if(!people.length)return status('Cadastre as pessoas desta célula antes de registrar o encontro.',true);if(!form.elements.date.value||form.elements.date.value<form.elements.date.min||form.elements.date.value>window.VideiraWeekly.today())return status('Confira a data: a chamada não pode ser futura, repetida ou anterior à última chamada.',true);const checked=new Set([...form.querySelectorAll('[name=present]:checked')].map(x=>x.value));const data={cell_id:id,date:form.elements.date.value,attendance:people.map(p=>({person_id:p.id,present:checked.has(p.id)}))};save('meeting',data)};
 }
 document.querySelectorAll('[data-call-archive]').forEach(button=>button.onclick=async()=>{if(busy)return;const restore=button.dataset.restore==='true';if(!confirm(restore?'Restaurar esta chamada nos relatórios?':'Excluir esta chamada dos relatórios? Você poderá restaurá-la em Chamadas excluídas.'))return;busy=true;button.disabled=true;try{await call('meeting_archive',{id:button.dataset.callArchive,restore});await reload();render();status(restore?'Chamada restaurada.':'Chamada excluída. Disponível em Chamadas excluídas.')}catch(e){status(e.message,true);button.disabled=false}finally{busy=false}});
 if(view==='reports'){const update=()=>{try{const filter={church:$('[name=filterChurch]').value,network:$('[name=filterNetwork]').value,from:$('[name=from]').value,to:$('[name=to]').value};reportRows();$('#reportVisuals').innerHTML=window.VideiraDashboard.visuals(db,filter);window.VideiraDashboard.bind($('#reportVisuals'),db,filter);bindViews();$('#reportTable').innerHTML=table(['Igreja','Município','Células','Pessoas','Membros','Visitantes','Presenças','Registros','Frequência'],reportRows().map(r=>[...r.map(esc),r[7]?Math.round(100*r[6]/r[7])+'%':'—']));status('')}catch(e){$('#reportVisuals').innerHTML='';$('#reportTable').innerHTML='';status(e.message,true)}};document.querySelectorAll('.report-filters input,.report-filters select').forEach(x=>x.onchange=update);update();$('#downloadExcel').onclick=()=>{try{const rows=reportRows();if(!rows.length)throw Error('Não há igrejas neste filtro.');const period=[$('[name=from]').value||'Primeiro registro',$('[name=to]').value||'Último registro'].join(' até '),bytes=createReportXlsx({rows,title:'Relatório · '+roles[db.profile.role],scope:roles[db.profile.role]+' / '+($('[name=filterChurch]').selectedOptions[0].textContent)+' / '+($('[name=filterNetwork]').selectedOptions[0].textContent),person:db.profile.display_name,period,issued:new Date().toLocaleString('pt-BR'),real:true}),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download='videira-relatorio-'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}catch(e){status(e.message,true)}};}
}
async function save(action,data){busy=true;document.querySelectorAll('form button').forEach(b=>b.disabled=true);status('Salvando no Supabase…');try{const result=await call(action,data);await reload();edit=null;render();status(action==='meeting'?`Encontro salvo. ${result.present} presentes; ${result.converted} visitante(s) convertido(s) em membro.`:'Cadastro salvo no Supabase.')}catch(e){status(e.message,true);document.querySelectorAll('form button').forEach(b=>b.disabled=false)}finally{busy=false}}
if(new URLSearchParams(location.search).get('senha')==='alterada'){$('#message').textContent='Senha alterada. Entre novamente.';$('#message').style.color='#28644c'}
const loginForm=$('#loginReal');
const loginButton=loginForm.querySelector('button');
loginForm.onsubmit=async event=>{
 event.preventDefault();
 if(busy)return;
 busy=true;
 loginButton.disabled=true;
 status('Conectando…');
 const {username,password}=Object.fromEntries(new FormData(loginForm));
 const remember=loginForm.elements.remember.checked;
 try{
  const tokens=await call('login',{username,password});
  clearSession();
  sessionStore=remember?localStorage:sessionStorage;
  saveTokens(tokens);
  loginForm.elements.password.value='';
  await reload();
  render();
 }catch(error){
  clearSession();
  status(error.message,true);
  loginForm.elements.password.value='';
  loginButton.disabled=false;
 }finally{busy=false}
};

async function restoreSession(){
 if(new URLSearchParams(location.search).get('senha')==='alterada'){clearSession();return}
 session=readSession(sessionStorage)||readSession(localStorage);
 if(!session)return;
 sessionStore=readSession(sessionStorage)?sessionStorage:localStorage;
 busy=true;
 loginButton.disabled=true;
 status('Restaurando sessão…');
 try{await reload();render()}catch(error){
  if(error.status===401)clearSession();
  status(error.message,true);
  loginButton.disabled=false;
 }finally{busy=false}
}

window.addEventListener('storage',event=>{
 if(event.key!==sessionKey||sessionStore!==localStorage)return;
 const saved=readSession(localStorage);
 if(!saved||saved.local_id!==session?.local_id)location.reload();
});
window.addEventListener('pageshow',event=>{
 if(event.persisted&&sessionStore&&!readSession(sessionStore))location.reload();
});
restoreSession();
})();
