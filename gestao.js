'use strict';
(()=>{
const cfg=window.VIDEIRA_CONFIG,$=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roles={master:'Master',supervisor:'Pastor Supervisor',supervisora_kids:'Pastora Supervisora',predio:'Pastor de Prédio',pastor:'Pastor de Rede',obreiro:'Obreiro',discipulador:'Discipulador',lider:'Líder de célula'};
let session=null,db=null,view='overview',edit=null,busy=false,accountRoleFilter='',accountChurchFilter='',ownProfile=null;
let metricKind,metricFilter;
function readManagementRoute(){
 const query=new URLSearchParams(location.search);
 metricKind=query.get('metric');
 view=['cells','members','frequency','visitors'].includes(metricKind)?'metric':(query.get('painel')||'overview');
 metricFilter=Object.fromEntries(['from','to','church'].map(key=>[key,query.get(key)||'']));
 edit=null;
}
readManagementRoute();
let memberSearch='',accountSearch='';
let memberForLeaderAccess=null;
const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
const discipleshipRoles=new Set(['master','discipulador','pastor','predio','obreiro','supervisor']);
const names={discipleship:'Acompanhamento do discipulado',overview:'Visão geral',profile:'Meu perfil',church:'Igrejas',network:'Redes',cell:'Células',person:'Membros e visitantes',meeting:'Presenças',reports:'Relatórios',site:'Editar site',accounts:'Contas e liderança'};
const cellEditorRoles=new Set(['master','supervisor','predio']);
const memberTransferRoles=new Set(['master','supervisor','pastor','obreiro','predio','supervisora_kids']);
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

const avatarRequests = new Map();
function cachedAvatar(key, load) {
 const now = Date.now();
 const cached = avatarRequests.get(key);
 if (cached && cached.expires > now) return cached.result;
 if (avatarRequests.size >= 120) avatarRequests.delete(avatarRequests.keys().next().value);
 const entry = {expires:now + 60000};
 entry.result = load().catch(error => {
  if (avatarRequests.get(key) === entry) avatarRequests.delete(key);
  throw error;
 });
 avatarRequests.set(key,entry);
 return entry.result;
}

function clearSession(){
 avatarRequests.clear();
 session=null;
 db=null;
 ownProfile=null;
 for(const store of [sessionStorage,localStorage]){
  try{store.removeItem(sessionKey)}catch{}
 }
}

async function request(action,data,token){
 if(action==='leadership_photo')return window.VideiraLeadershipPhoto.request(token,data.id,data.photo);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),30000);
 try{
  const rpc={discipleship_person_field:'videira_discipleship_person_field',report_courses:'videira_report_courses',discipleship:'videira_discipleship',link_existing_leader:'videira_link_existing_leader',
   member_leader_links:'videira_member_leader_links',person_photo:'videira_portal'}[action];
  const payload=action==='person_photo'?{p_action:action,p_data:data}:rpc?(data||{}):action==='login'?{action,...data}:{action,data};
  const response=await fetch(rpc?cfg.url+'/rest/v1/rpc/'+rpc:cfg.gateway,{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:cfg.publicKey,
    Authorization:'Bearer '+(rpc?token:cfg.publicKey),
    ...(rpc?{}:{'X-Videira-Session':token||''})},
   body:JSON.stringify(payload),
   signal:controller.signal
  });
  const result=await response.json();
  if(!response.ok){
   const failure=Error(result.error||(rpc&&result.message)||'Não foi possível concluir esta operação.');
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
 if(view==='cell')fields=field('name','Nome da célula',item.name,'text','required maxlength="180"')+select('church_id','Igreja',db.churches,item.church_id)+select('network_id','Rede',db.networks,item.network_id)+`<label>Situação da célula<select name="is_paused"><option value="false">Está acontecendo</option><option value="true" ${item.is_paused?'selected':''}>Não está acontecendo</option></select></label>`+window.VideiraWeekly.fields(item)+window.VideiraLocation.fields(item)+select('leader_id','Líder',db.profiles.filter(x=>x.active&&['lider','discipulador','master','supervisor','predio'].includes(x.role)),item.leader_id,'display_name',true)+select('discipler_id','Discipulador',db.profiles.filter(x=>x.active&&x.role==='discipulador'),item.discipler_id,'display_name',true);
 if(view==='person')fields=`
  <div class="profile-photo-row wide">
   <div id="memberPhotoPreview" class="profile-avatar"><span aria-label="Sem foto">—</span></div>
   <div>
    <label>Foto do membro ou visitante (opcional)<input id="memberPhotoFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <small>JPG, PNG ou WebP · até 8 MB</small>
    <div class="actions"><button type="button" class="secondary" id="cropMemberPhoto" hidden>Ajustar enquadramento</button></div>
    <p id="memberPhotoFeedback" role="status"></p>
   </div>
  </div>`+field('full_name','Nome completo',item.full_name,'text','required maxlength="180"')+(!edit||memberTransferRoles.has(db.profile.role)
  ?select('cell_id','Célula',db.cells,item.cell_id)
  :`<label>Célula<input value="${esc(label(db.cells,item.cell_id))}" readonly></label>`)+field('phone','Telefone (opcional)',item.phone,'tel',window.VideiraPhone.attributes)+field('birth_date','Data de nascimento (opcional)',item.birth_date,'date','autocomplete="bday"')+`<label>Categoria<select name="category"><option value="Visitante">Visitante</option><option value="Membro" ${item.category==='Membro'?'selected':''}>Membro</option></select></label><label>Batismo<select name="baptized">${['Não informado','Sim','Não'].map(v=>`<option ${item.baptized===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Estado civil<select name="marital_status">${['Não informado','Solteiro(a)','Casado(a)','Divorciado(a)','Viúvo(a)'].map(v=>`<option ${item.marital_status===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Dizimista<select name="is_tither"><option value="">Não informado</option><option value="true" ${item.is_tither===true?'selected':''}>Sim</option><option value="false" ${item.is_tither===false?'selected':''}>Não</option></select></label>`;
 return `<article class="panel"><h2>${edit?'Editar cadastro':'Novo cadastro'}</h2><form id="entityForm" class="gridform">${fields}<div class="wide actions"><button>Salvar no Supabase</button>${edit?'<button type="button" class="secondary" id="cancelEdit">Cancelar edição</button>':''}</div></form>${view==='person'&&edit&&item.active&&item.category==='Membro'&&db.profile.role==='master'?'<div class="actions"><button class="secondary" id="createMemberLeader" type="button" hidden>Criar acesso de liderança</button><button class="secondary" id="linkExistingLeader" type="button" hidden>Vincular conta de liderança existente</button><span id="memberLeaderStatus" role="status"></span></div><div id="existingLeaderForm"></div>':''}${view==='person'?'<p><small>O acompanhamento do discipulado registra presenças e o início dos cursos.</small></p>':''}</article>`;
}
let cellSearch = '', cellStatus = '';

function cellFilters() {
 return `<div class="gridform">
  <label>Pesquisar células<input id="cellSearch" type="search" value="${esc(cellSearch)}" placeholder="Célula, discipulador, líder, rede ou endereço…" autocomplete="off"></label>
  <label>Situação<select id="cellStatus">
   <option value="">Todas as situações</option>
   <option value="active" ${cellStatus==='active'?'selected':''}>Está acontecendo</option>
   <option value="paused" ${cellStatus==='paused'?'selected':''}>Não está acontecendo</option>
  </select></label>
 </div><p id="cellSearchEmpty" role="status" hidden>Nenhuma célula encontrada para esses filtros.</p>`;
}

function bindCellFilters() {
 const search = $('#cellSearch'), situation = $('#cellStatus'), empty = $('#cellSearchEmpty');
 const leadership = new Map([...(db.cell_leadership || []), ...db.profiles].map(profile => [profile.id, profile.display_name]));
 const entries = [...document.querySelectorAll('#workspace tbody tr')].map((row,index) => {
  const cell = db.cells[index];
  const address = cell.address_details || {};
  const parts = [cell.name, leadership.get(cell.discipler_id), leadership.get(cell.leader_id),
   label(db.networks, cell.network_id), cell.private_address, address.street, address.house_number,
   address.complement, address.neighborhood, address.city, address.state, address.postal_code];
  return { row, text: normalizeSearch(parts.join(' ')).replace(/[^\p{L}\p{N}]+/gu, ' '), paused: Boolean(cell.is_paused) };
 });
 const update = () => {
  cellSearch = search.value;
  cellStatus = situation.value;
  const terms = normalizeSearch(cellSearch).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const { row, text, paused } of entries) {
   row.hidden = (cellStatus !== '' && paused !== (cellStatus === 'paused'))
    || !terms.every(term => text.includes(term));
  }
  empty.hidden = !entries.length || entries.some(({ row }) => !row.hidden);
 };
 search.oninput = update;
 situation.onchange = update;
 update();
}

function entityList(){const headers=view==='church'?['Igreja','Município','']:view==='network'?['Rede','Igreja','Tipo','']:view==='cell'?['Célula','Rede','Encontro','Situação','']:['Nome','Categoria','Célula',''];return `<article class="panel">${view==='person'?`<label class="member-search">Pesquisar cadastros<input id="memberSearch" type="search" value="${esc(memberSearch)}" placeholder="Nome, célula, nascimento, telefone…" autocomplete="off"></label><p id="memberSearchEmpty" role="status" hidden>Nenhum cadastro encontrado para essa busca.</p>`:view==='cell'?cellFilters():''}${table(headers,db[list[view]].map(x=>[...(view==='church'?[esc(x.name),esc(x.municipality)]:view==='network'?[esc(x.name),esc(label(db.churches,x.church_id)),x.kind==='kids'?'Kids':'Regular']:view==='cell'?[esc(x.name),esc(label(db.networks,x.network_id)),esc(x.meeting_schedule),x.is_paused?'Não está acontecendo':'Está acontecendo']:[window.VideiraDashboard.personName(x.id,x.full_name),esc(x.category),esc(label(db.cells,x.cell_id))]),view==='cell'&&!cellEditorRoles.has(db.profile.role)?'':`<button class="secondary" data-edit="${x.id}">Editar</button>`]))}</article>`}
function meetingCells(){return ['master','supervisor','predio'].includes(db.profile.role)?db.cells.filter(c=>c.leader_id===db.profile.id):db.cells}
function meeting(){const cells=meetingCells();return `<section class="meeting-picker"><h2>Escolha a célula para fazer a chamada</h2><p>Cada cartão mostra o dia e horário semanal cadastrados.</p>${['master','supervisor','predio'].includes(db.profile.role)?'<div class="notice">Aqui aparecem as células vinculadas a você como líder.</div>':''}<div class="meeting-cell-grid">${cells.map(c=>`<button type="button" class="meeting-cell-card${c.is_paused?' meeting-cell-paused':''}" data-meeting-cell="${esc(c.id)}" aria-pressed="false" aria-controls="meetingEntry"><svg class="meeting-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h3m2 0h3"/></svg><strong>${esc(c.name)}</strong><span class="meeting-card-schedule">${c.is_paused?'Não está acontecendo':esc(c.meeting_schedule||'Dia e horário ainda não informados')}</span><small>${db.people.filter(p=>p.cell_id===c.id).length} pessoa(s) cadastrada(s)</small><span class="meeting-card-action">Fazer chamada →</span></button>`).join('')||'<div class="empty">Nenhuma célula disponível para sua chamada. Confira o vínculo do líder no cadastro da célula.</div>'}</div></section><article class="panel meeting-entry" id="meetingEntry" hidden><div class="meeting-entry-heading"><div><small>CHAMADA DA CÉLULA</small><h2 id="meetingCellTitle"></h2><p id="meetingCellSchedule"></p></div><button type="button" class="secondary" id="closeMeeting">Voltar às células</button></div><p>Confira os participantes e salve a chamada após o encontro. A data não pode ser futura, repetir ou preceder o último encontro registrado.</p><form id="meetingForm"><input type="hidden" name="cell_id"><div class="meeting-today"><span>Data do encontro: <strong id="meetingDateDisplay"></strong></span><details id="changeMeetingDate"><summary>Alterar data</summary>${field('date','Data do encontro','','date','required')}</details></div><p id="meetingDateHelp" class="notice" role="status"></p><div id="attendance" style="margin-top:20px"></div><div id="cellTrainee" class="notice" hidden>
 <label>Líder em treinamento (opcional)<select id="cellTraineeSelect"></select></label>
 <div class="actions"><button type="button" class="secondary" id="saveCellTrainee">Salvar líder em treinamento</button></div>
 <small id="cellTraineeStatus" role="status"></small>
 </div><div class="actions"><button id="saveMeeting">Salvar presenças</button><button type="button" class="secondary" id="markAll">Marcar todos</button></div></form></article>${callHistory()}`}
function callHistory(){if(!['master','supervisor','predio','pastor','obreiro','supervisora_kids'].includes(db.profile.role))return '';const rows=(items,removed)=>table(['Data','Célula','Ações'],items.slice().sort((a,b)=>b.meeting_date.localeCompare(a.meeting_date)).map(m=>[esc(m.meeting_date.split('-').reverse().join('/')),esc(label(db.cells,m.cell_id)),`<button type="button" class="secondary" data-call-archive="${esc(m.id)}" data-restore="${removed}">${removed?'Restaurar':'Excluir chamada'}</button>`]));return `<article class="panel"><h2>Chamadas salvas</h2><p>Somente as células sob sua gestão. Chamadas excluídas saem dos relatórios e podem ser restauradas. A categoria atual dos membros é preservada.</p>${rows(db.meetings,false)}<details class="archived-calls"><summary>Chamadas excluídas (${(db.archived_meetings||[]).length})</summary>${rows(db.archived_meetings||[],true)}</details></article>`}
const kidsRoleNames={pastor:'Pastora Kids',obreiro:'Obreira',discipulador:'Discipuladora Kids'};
const isKidsNetwork=id=>db.networks.some(network=>network.id===id&&network.kind==='kids');
const roleName=profile=>(isKidsNetwork(profile.network_id)&&kidsRoleNames[profile.role])||roles[profile.role];
function assignKidsSupervisorScope(data, currentNetwork, preferredChurch){
 if(data.role!=='supervisora_kids')return true;
 const kids=db.networks.filter(network=>network.kind==='kids');
 const reference=kids.find(network=>network.id===currentNetwork)
  || kids.find(network=>network.church_id===preferredChurch) || kids[0];
 if(!reference)return false;
 data.church_id=reference.church_id;
 data.network_id=reference.id;
 return true;
}
function updateRoleOptions(form){
 const kids=isKidsNetwork(form.elements.network_id.value);
 for(const option of form.elements.role.options){
  if(roles[option.value])option.textContent=(kids&&kidsRoleNames[option.value])||roles[option.value];
 }
}
const accountRoleOrder={master:0,supervisor:1,supervisora_kids:1,pastor:2,predio:3,obreiro:4,discipulador:5,lider:6};
const accountNameOrder=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
function accountColumns(profile){
 const churchAndNetwork=profile.role==='supervisora_kids'?'Redes Kids de todas as igrejas':['master','supervisor'].includes(profile.role)?'Todas as igrejas e redes':
  label(db.churches,profile.church_id)+' / '+(profile.role==='predio'||profile.role==='obreiro'&&!profile.network_id
   ?'Todas as redes':label(db.networks,profile.network_id));
 return [profile.display_name,profile.username,roleName(profile),churchAndNetwork,profile.active?'Ativo':'Desativado'];
}
function linkedProfiles(){
 const terms=normalizeSearch(accountSearch).split(/\s+/).filter(Boolean);
 return db.profiles.filter(profile=>{
  const matchesRole=!accountRoleFilter||profile.role===accountRoleFilter;
  const matchesChurch=!accountChurchFilter||(accountChurchFilter==='__global__'
   ?['master','supervisor'].includes(profile.role):profile.church_id===accountChurchFilter);
  const text=normalizeSearch(accountColumns(profile).join(' '));
  return matchesRole&&matchesChurch&&terms.every(term=>text.includes(term));
 }).sort((a,b)=>(accountRoleOrder[a.role]??99)-(accountRoleOrder[b.role]??99)||
  accountNameOrder.compare(a.display_name,b.display_name)||accountNameOrder.compare(a.username,b.username));
}
function linkedAccountTable(){
 const profiles=linkedProfiles(),master=db.profile.role==='master';
 const headers=['Nome','Usuário','Função','Igreja / rede','Estado'];
 if(master)headers.push('Ações');
 if(!profiles.length)return '<div class="empty">'+(accountSearch.trim()||accountRoleFilter||accountChurchFilter
  ?'Nenhuma conta encontrada para essa busca e filtros.':'Nenhum cadastro neste escopo.')+'</div>';
 return table(headers,profiles.map(profile=>{
  const row=accountColumns(profile).map(esc);
  if(master)row[0]=window.VideiraDashboard.personName(profile.id,profile.display_name);
  if(master)row.push(`<button type="button" class="secondary" data-account-edit="${esc(profile.id)}">Editar conta</button>`);
  return row;
 }));
}
function linkedAccountCount(){const n=linkedProfiles().length;return n+' de '+db.profiles.length+' '+(db.profiles.length===1?'conta':'contas')}
async function requestLeadershipPhoto(id, photo) {
 const key = 'leadership:' + id;
 if (photo === undefined) return cachedAvatar(key,()=>call('leadership_photo',{id}));
 const result = await call('leadership_photo',{id,photo});
 avatarRequests.delete(key);
 return result;
}
function accounts(){const master=db.profile.role==='master';return `${master?`<article class="panel"><h2>Cadastrar acesso da liderança</h2><p>Crie o acesso e depois vincule o líder ou discipulador à célula correspondente na aba Células.</p>${`<form id="accountForm" class="gridform">${window.VideiraLeadershipPhoto.field()}${field('display_name','Nome completo','','text','required maxlength="180" autocomplete="name"')}${field('username','Nome de usuário','','text','required minlength="3" maxlength="50" pattern="[a-z0-9][a-z0-9._-]{2,49}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ex.: maria.silva"')}${field('phone','Telefone celular (opcional)','','tel',window.VideiraPhone.attributes)}${field('birth_date','Data de nascimento (opcional)','','date','autocomplete="bday"')}${field('email','E-mail (opcional)','','email','maxlength="254" autocomplete="off"')}${select('church_id','Igreja',db.churches)}<label>Rede<select name="network_id" required><option value="">Selecione a igreja primeiro</option></select></label><label>Função<select name="role" required><option value="lider">Líder de célula</option><option value="master">Master</option><option value="supervisor">Pastor Supervisor</option><option value="supervisora_kids">Pastora Supervisora</option><option value="discipulador">Discipulador</option><option value="predio">Pastor de Prédio</option><option value="pastor">Pastor de Rede</option><option value="obreiro">Obreiro</option></select></label>${field('password','Senha inicial','','password','required minlength="8" maxlength="128" autocomplete="new-password"')}${field('confirm_password','Confirme a senha inicial','','password','required minlength="8" maxlength="128" autocomplete="new-password"')}<div class="notice wide">A senha inicial precisa ter de 8 a 128 caracteres. Entregue o usuário e a senha à pessoa por um meio privado. O e-mail é opcional: o acesso funciona com usuário e senha. Este cadastro não envia e-mail automaticamente. O e-mail não será exibido na lista de liderança nem no site público.</div><div class="notice wide" id="accountScope"></div><div class="wide actions"><button>Criar cadastro e acesso</button></div></form>`}</article>`:''}<article class="panel"><div class="account-list-toolbar"><div><h2>Contas vinculadas</h2><small id="accountCount" aria-live="polite">${linkedAccountCount()}</small></div><div class="account-list-filters"><label>Pesquisar contas<input id="accountSearch" type="search" value="${esc(accountSearch)}" placeholder="Nome, usuário, função, igreja, rede ou estado…" autocomplete="off"></label><label>Filtrar por função<select id="accountRoleFilter"><option value="">Todas as funções</option>${Object.keys(accountRoleOrder).map(role=>`<option value="${role}" ${accountRoleFilter===role?'selected':''}>${roles[role]}</option>`).join('')}</select></label><label>Filtrar por igreja<select id="accountChurchFilter"><option value="">Todas as igrejas</option><option value="__global__" ${accountChurchFilter==='__global__'?'selected':''}>Acesso a todas (Master/Supervisor)</option>${db.churches.slice().sort((a,b)=>accountNameOrder.compare(a.name,b.name)).map(c=>`<option value="${c.id}" ${accountChurchFilter===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div></div><p class="account-order-note">Master · Pastor Supervisor · Pastor de Rede · Pastor de Prédio · Obreiros · Discipulador · Líder de Célula</p><div id="linkedAccounts">${linkedAccountTable()}</div></article>`}

function bindBirthdayCarousel(panel) {
 const track = panel.querySelector('.birthday-grid');
 const controls = panel.querySelector('.birthday-controls');
 const [previous, next] = controls.querySelectorAll('button');
 const motion = matchMedia('(prefers-reduced-motion: reduce)');
 const update = () => {
  const limit = track.scrollWidth - track.clientWidth;
  controls.hidden = limit < 2;
  previous.setAttribute('aria-disabled', String(track.scrollLeft < 2));
  next.setAttribute('aria-disabled', String(track.scrollLeft >= limit - 2));
 };
 for (const [button, direction] of [[previous, -1], [next, 1]]) {
  button.onclick = () => {
   if (button.getAttribute('aria-disabled') === 'true') return;
   const gap = parseFloat(getComputedStyle(track).columnGap);
   track.scrollBy({
    left: direction * (track.firstElementChild.getBoundingClientRect().width + gap),
    behavior: motion.matches ? 'instant' : 'smooth'
   });
  };
 }
 track.addEventListener('scroll', update, {passive: true});
 if (window.ResizeObserver) new ResizeObserver(update).observe(track);
 update();
}

async function loadBirthdays(panel) {
 try {
  const {month,entries}=await call('birthdays');
  if(!panel.isConnected)return;
  const monthName=new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'})
   .format(new Date(Date.UTC(2000,month-1,1)));
  const cellsById=new Map(db.cells.map(cell=>[cell.id,cell]));
  const cards=entries.map(person=>{
   const date=String(person.day).padStart(2,'0')+'/'+String(month).padStart(2,'0');
   const members=db.people.filter(member=>person.member_photo_id
    ? member.id===person.member_photo_id
    : member.category===person.kind&&member.full_name===person.name
     && member.birth_date?.slice(5)===date.split('/').reverse().join('-')
     && cellsById.get(member.cell_id)?.name===person.group_name);
   const accounts=db.profiles.filter(profile=>profile.role===person.kind&&profile.display_name===person.name);
   const account=accounts.length===1?accounts[0]:null;
   const linkedCells=account?db.cells.filter(cell=>[cell.leader_id,cell.discipler_id].includes(account.id)):[];
   const networkIds=person.kind==='Membro'
    ? (members.length===1?[cellsById.get(members[0].cell_id)?.network_id]:[])
    : linkedCells.length?linkedCells.map(cell=>cell.network_id):[account?.network_id];
   const networks=[...new Set(networkIds.filter(Boolean).map(id=>label(db.networks,id)).filter(Boolean))];
   const cellName=person.kind==='Membro'?person.group_name:
    [...new Set(linkedCells.map(cell=>cell.name))].join(', ');
   return `<li class="birthday-card">
    <span class="birthday-avatar" aria-hidden="true"${person.member_photo_id?` data-person-photo="${esc(person.member_photo_id)}"`:''}${person.photo_url?` data-photo-url="${esc(person.photo_url)}"`:''}>
     ${esc(personInitials(person.name))}
    </span>
    <div class="birthday-copy"><div class="birthday-name"><strong>${esc(person.name)}</strong><span class="birthday-date">${date}</span></div>
     <span>${esc(cellName||'Célula não informada')}</span>
     <span>${esc(networks.join(', ')||'Rede não informada')}</span>
    </div>
   </li>`;
  });
  panel.innerHTML=`<div class="birthday-header">
   <h2>Aniversariantes de ${esc(monthName)}</h2>
   ${cards.length?`<div class="birthday-controls" hidden>
      <button type="button" class="secondary" aria-label="Aniversariantes anteriores" aria-controls="birthdayTrack"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg></button>
      <button type="button" class="secondary" aria-label="Próximos aniversariantes" aria-controls="birthdayTrack"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>
     </div>`:''}
  </div>`+(cards.length?`<ul id="birthdayTrack" class="birthday-grid" tabindex="0" aria-label="Aniversariantes do mês">${cards.join('')}</ul>`:
    '<p>Nenhum aniversário cadastrado neste mês no seu escopo.</p>');
  if(cards.length)bindBirthdayCarousel(panel);
  loadPersonPhotos(panel);
 } catch(error) {
  if(panel.isConnected)panel.querySelector('[role=status]').textContent=error.message||'Não foi possível carregar os aniversariantes.';
 }
}

function managementTabs(){return ['overview','profile',...(discipleshipRoles.has(db.profile.role)?['discipleship']:[]),...(['master','supervisor'].includes(db.profile.role)?['church','network','cell']:db.profile.role==='predio'?['network','cell']:['pastor','obreiro','supervisora_kids'].includes(db.profile.role)?['cell']:[]),'person','meeting','reports','accounts',...(db.profile.role==='master'?['site']:[])];}
function openManagementSection(section){
 const url=new URL(location.href);
 if(url.searchParams.has('metric')){
  for(const key of ['metric','from','to','church'])url.searchParams.delete(key);
 }
 if(section==='overview')url.searchParams.delete('painel');
 else url.searchParams.set('painel',section);
 if(url.href!==location.href)history.pushState(null,'',url);
 document.title='Gestão · Igreja Videira';
 view=section;
}
function render(){const menuScroll=$('.shell > aside > nav')?.scrollLeft??0;
 const tabs=managementTabs();
 if(view!=='metric'&&!tabs.includes(view)){
  const url=new URL(location.href);
  url.searchParams.delete('painel');
  history.replaceState(null,'',url);
  view='overview';
  edit=null;
 }
$('#app').innerHTML=`<div class="shell"><aside><img class="management-logo" src="assets/logo.png" alt="Videira"><div class="identity"><div><span class="attendance-avatar identity-photo" id="identityPhoto" aria-hidden="true">${esc(personInitials(db.profile.display_name))}</span>${esc(db.profile.display_name)}<small>${roleName(db.profile)} · ${esc(db.profile.username)}</small></div><button class="secondary" id="logout">Sair</button></div><nav aria-label="Gestão">${tabs.map(v=>`<button data-view="${v}" class="${view===v?'active':''}">${names[v]}</button>`).join('')}</nav></aside><main class="main ${view==='overview'?'dashboard-main':''}"><div class="top"><span class="badge">Conectado ao Supabase · Dados reais</span><a href="index.html">Ver site ↗</a></div>${view==='overview'?'':`<div class="heading ${view==='metric'?'directory-heading':''}"><small>${view==='metric'?'Gestão / Visão geral':'IGREJA VIDEIRA / GESTÃO'}</small><h1>${view==='metric'?window.VideiraDashboard.metricTitle(db,metricKind)||'Indicador':names[view]}</h1>${view==='metric'?'<a class="directory-back" href="gestao.html?v=20261112-panel-nav">← Voltar à Visão geral</a>':'<p>Somente os registros permitidos ao seu perfil.</p>'}</div>`}<div id="status" role="status" aria-live="polite"></div><div id="workspace">${view==='overview'?overview():view==='metric'?'<section id="metricPage" class="dashboard"></section>':view==='discipleship'?'<div id="discipleshipPanel"></div>':view==='site'?'<div id="siteEditor"></div>':view==='profile'?'<div id="myProfile"></div>':list[view]?entityForm()+entityList():view==='meeting'?meeting():view==='reports'?'<div id="personReports"></div>':accounts()}</div><small>Gravação no servidor. Membros, telefones e presenças não são publicados no site.</small></main></div>`;$('.shell > aside > nav').scrollLeft=menuScroll;bind();}
function bindMemberPhoto(form,id){
 const file=form.querySelector('#memberPhotoFile');
 const preview=form.querySelector('#memberPhotoPreview');
 const feedback=form.querySelector('#memberPhotoFeedback');
 const photo={processing:false,image:null};
 const adjust=form.querySelector('#cropMemberPhoto');
 let selection=0,original=null,position=null;
 const show=(value,alt)=>{
  const img=document.createElement('img');
  img.src='data:image/jpeg;base64,'+value;
  img.alt=alt;
  preview.replaceChildren(img);
 };
 if(id)requestPersonPhoto(id).then(photo_base64=>{
  if(!form.isConnected||!photo_base64)return;
  if(!original)original='data:image/jpeg;base64,'+photo_base64;
  if(!photo.image){
   show(photo_base64,'Foto atual do membro');
   adjust.hidden=false;
  }
 }).catch(()=>{
  if(form.isConnected&&selection===0)feedback.textContent='Não foi possível carregar a foto atual.';
 });
 const editPhoto=async(source,trigger)=>{
  if(photo.processing||busy)return;
  const version=++selection;
  photo.processing=true;
  feedback.textContent='';
  try{
   const image=await window.VideiraProfile.cropPhoto(source,trigger,source===original?position:null);
   if(!image||version!==selection||!form.isConnected)return;
   original=source;
   position=image.position;
   photo.image=image.value;
   adjust.hidden=false;
   show(image.value,'Prévia da foto do membro');
   feedback.textContent='Salve o cadastro para confirmar a foto.';
  }catch(error){
   if(version===selection)feedback.textContent=error.message;
  }finally{
   if(version===selection){photo.processing=false;file.value=''}
  }
 };
 file.onchange=()=>{if(file.files[0])editPhoto(file.files[0],file)};
 adjust.onclick=()=>editPhoto(original,adjust);
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
     const photo_base64=await requestPersonPhoto(avatar.dataset.personPhoto);
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

function renderManagementRoute(){
 readManagementRoute();
 memberForLeaderAccess=null;
 document.title='Gestão · Igreja Videira';
 render();
 window.scrollTo(0,0);
 const heading=$('main h1');
 if(heading){
  heading.tabIndex=-1;
  heading.focus({preventScroll:true});
 }
}

$('#app').addEventListener('click',event=>{
 const link=event.target.closest('a[data-dash-metric],a.directory-back');
 if(!link||!session||!db||event.defaultPrevented||event.button!==0||
    event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();
 history.pushState(null,'',link.href);
 renderManagementRoute();
});
window.addEventListener('popstate',()=>{
 if(session&&db)renderManagementRoute();
});

const requestPersonPhoto = id => cachedAvatar('person:'+id,async ()=>(await call('person_photo',{id})).photo_base64);

async function showIdentityPhoto() {
 const avatar = $('#identityPhoto');
 const profile = db.profile;
 async function show(source) {
  if (!source || !avatar.isConnected) return false;
  const image = new Image();
  image.alt = '';
  image.src = source;
  try { await image.decode(); } catch { return false; }
  if (!avatar.isConnected) return false;
  avatar.replaceChildren(image);
  return true;
 }
 if (await show(ownProfile?.photo_url) || !avatar.isConnected) return;
 if (!['supervisor','pastor','predio','obreiro','discipulador','lider'].includes(profile.role)) return;
 try {
  const response = await fetch(cfg.url+'/rest/v1/rpc/videira_public_leadership_photo',{
   method:'POST',
   headers:{apikey:cfg.publicKey,Authorization:'Bearer '+cfg.publicKey,'Content-Type':'application/json'},
   body:JSON.stringify({p_id:profile.id})
  });
  if (!response.ok) return;
  const photo = await response.json();
  if (typeof photo === 'string' && photo) await show('data:image/jpeg;base64,'+photo);
 } catch {
  // Keep the initials if the photo is unavailable.
 }
}

function bind(){
 showIdentityPhoto();const bindViews=()=>document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
 openManagementSection(b.dataset.view);edit=null;memberForLeaderAccess=null;render();
});bindViews();
 if(view==='overview'){const filters=()=>({from:window.VideiraDashboard.startDate($('#dashboardPeriod').value),church:$('#dashboardChurch')?.value||''}),bindDashboard=()=>window.VideiraDashboard.bind($('#dashboardVisuals'),db,filters()),update=()=>{
  const birthdays=$('#birthdaysPanel');
  $('#dashboardVisuals').innerHTML=window.VideiraDashboard.visuals(db,filters(),true);
  $('#birthdaysPanel').replaceWith(birthdays);
  bindDashboard();bindViews();
 };bindDashboard();loadBirthdays($('#birthdaysPanel'));$('#dashboardPeriod').onchange=update;if($('#dashboardChurch'))$('#dashboardChurch').onchange=update}

 if(view==='discipleship')window.VideiraDiscipleship.mount($('#discipleshipPanel'),call,esc,['master','discipulador'].includes(db.profile.role),db);
 if(view==='cell')bindCellFilters();
 if(view==='person'){
  const search=$('#memberSearch');
  const empty=$('#memberSearchEmpty');
  const normalize=normalizeSearch;
  const people=new Map(db.people.map(person=>[person.id,person]));
  const cells=new Map(db.cells.map(cell=>[cell.id,cell]));
  const entries=[...document.querySelectorAll('#workspace tbody tr')].map(row=>{
   const person=people.get(row.querySelector('[data-edit]').dataset.edit);
   const cell=cells.get(person.cell_id);
   const date=person.birth_date||'';
   const phone=person.phone||'';
   const fields=[person.full_name,cell?.name,person.category,person.baptized,person.marital_status,
    label(db.churches,cell?.church_id),label(db.networks,cell?.network_id),date,
    date.split('-').reverse().join('/'),phone];
   return {row,text:fields.map(normalize).join(' '),digits:phone.replace(/\D/g,'')};
  });
  const updateSearch=()=>{
   memberSearch=search.value;
   const query=normalize(memberSearch);
   const terms=query.split(/\s+/);
   const phoneQuery=/^[+()\d\s.-]+$/.test(query)?query.replace(/\D/g,''):'';
   for(const {row,text,digits} of entries){
    row.hidden=!terms.every(term=>text.includes(term))&&!(phoneQuery&&digits.includes(phoneQuery));
   }
   empty.hidden=!query||entries.some(({row})=>!row.hidden);
  };
  search.oninput=updateSearch;
  updateSearch();
  window.VideiraDashboard.personPhotos($('#workspace'),requestPersonPhoto)();
 }
 $('#logout').onclick=async()=>{try{await call('logout')}catch{}finally{clearSession();location.reload()}};document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{edit=b.dataset.edit;render();$('#workspace').scrollIntoView({behavior:'smooth'})});if($('#cancelEdit'))$('#cancelEdit').onclick=()=>{edit=null;render()};
 if(view==='metric'){
  const dashboard=window.VideiraDashboard;
  document.title=(dashboard.metricTitle(db,metricKind)||'Indicador')+' · Igreja Videira';
  dashboard.mountMetric($('#metricPage'),db,metricKind,metricFilter,requestPersonPhoto, id => {
   if (!db.people.some(person => person.id === id)) return;
   openManagementSection('person');
   edit = id;
   render();
   $('#entityForm').scrollIntoView({block:'start'});
   $('#entityForm [name=full_name]').focus({preventScroll:true});
  });
 }
 if(view==='site')window.VideiraSiteEditor.mount($('#siteEditor'),{call,profile:db.profile,config:cfg,getSession:()=>session});
 if(view==='profile')window.VideiraProfile.mount($('#myProfile'),{call,onSaved:async()=>{await reload();render();status('Perfil atualizado no Supabase.')},onPasswordChanged:()=>{clearSession();location.href='gestao.html?senha=alterada'}});
 const bindAccountEditors=()=>document.querySelectorAll('[data-account-edit]').forEach(button=>button.onclick=()=>window.VideiraAccountEditor.open({id:button.dataset.accountEdit,call,requestPhoto:requestLeadershipPhoto,churches:db.churches,networks:db.networks,roles,updateRoleOptions,assignKidsSupervisorScope,selfId:db.profile.id,onSaved:async()=>{await reload();if(accountList?.isConnected){
  bindAccountPhotos=accountPhotoLoader();
  updateAccountFilters();
 }status('Conta atualizada no Supabase.')},onReset:()=>status('Senha da conta redefinida.')}));
 const accountList=$('#linkedAccounts');
 const accountPhotoLoader=()=>window.VideiraDashboard.personPhotos(accountList,async id=>(await requestLeadershipPhoto(id)).photo||await cachedAvatar('linked:'+id,async ()=>(await call('linked_member_avatar',{id})).photo));
 let bindAccountPhotos=accountList&&db.profile.role==='master'?accountPhotoLoader():null;
 const updateAccountFilters=()=>{
  accountList.innerHTML=linkedAccountTable();
  $('#accountCount').textContent=linkedAccountCount();
  bindAccountEditors();
  bindAccountPhotos?.();
 };
 bindAccountEditors();
 bindAccountPhotos?.();
 if($('#accountSearch'))$('#accountSearch').oninput=e=>{accountSearch=e.target.value;updateAccountFilters()};
 if($('#accountRoleFilter'))$('#accountRoleFilter').onchange=e=>{accountRoleFilter=e.target.value;updateAccountFilters()};
 if($('#accountChurchFilter'))$('#accountChurchFilter').onchange=e=>{accountChurchFilter=e.target.value;updateAccountFilters()};
 const createMemberLeader=$('#createMemberLeader');
 if(createMemberLeader){
  const member=db.people.find(person=>person.id===edit);
  call('member_leader_links').then(links=>{
   if(!createMemberLeader.isConnected)return;
   if(Object.hasOwn(links,member.id)){
    const account=db.profiles.find(profile=>profile.id===links[member.id]);
    $('#memberLeaderStatus').textContent=account
     ? 'Conta vinculada: '+account.display_name+' (@'+account.username+').'
     : 'Acesso de liderança já vinculado.';
    return;
   }
   const linkButton=$('#linkExistingLeader');
   const linkContainer=$('#existingLeaderForm');
   const linkedAccounts=new Set(Object.values(links));
   const candidates=db.profiles.filter(profile=>['lider','discipulador'].includes(profile.role)&&profile.active&&!linkedAccounts.has(profile.id))
    .map(profile=>({id:profile.id,label:[profile.display_name,'@'+profile.username,roleName(profile),
     label(db.churches,profile.church_id),label(db.networks,profile.network_id)].join(' · ')}));
   linkButton.hidden=false;
   linkButton.onclick=()=>{
    if(busy)return;
    if(!candidates.length){
     $('#memberLeaderStatus').textContent='Nenhuma conta de líder ou discipulador está disponível para vínculo.';
     return;
    }
    linkContainer.innerHTML=`<form class="gridform">
     ${select('profile_id','Conta de liderança',candidates,'','label')}
     <div class="actions wide"><button>Vincular conta</button><button type="button" class="secondary">Cancelar</button></div>
    </form>`;
    const form=linkContainer.querySelector('form');
    const accountSelect=form.elements.profile_id;
    const [confirm,cancel]=form.querySelectorAll('button');
    accountSelect.focus();
    cancel.onclick=()=>{linkContainer.replaceChildren();linkButton.focus({preventScroll:true});};
    form.onsubmit=async event=>{
     event.preventDefault();
     if(busy)return;
     const profileId=accountSelect.value;
     busy=true;
     confirm.disabled=cancel.disabled=accountSelect.disabled=true;
     try{
      await call('link_existing_leader',{p_member_id:member.id,p_profile_id:profileId});
      avatarRequests.delete('linked:'+profileId);
      if(!form.isConnected)return;
      const account=db.profiles.find(profile=>profile.id===profileId);
      linkContainer.replaceChildren();
      linkButton.hidden=createMemberLeader.hidden=true;
      $('#memberLeaderStatus').textContent='Conta vinculada: '+account.display_name+' (@'+account.username+').';
     }catch(error){
      if(form.isConnected)$('#memberLeaderStatus').textContent=error.message;
     }finally{
      busy=false;
      confirm.disabled=cancel.disabled=accountSelect.disabled=false;
     }
    };
   };
   createMemberLeader.hidden=false;
   createMemberLeader.onclick=()=>{
    if(busy)return;
    memberForLeaderAccess=member;
    openManagementSection('accounts');
    edit=null;
    render();
    $('#accountForm')?.scrollIntoView({block:'start'});
   };
  }).catch(()=>{
   if(createMemberLeader.isConnected)$('#memberLeaderStatus').textContent='Não foi possível consultar o vínculo de liderança.';
  });
 }
 if($('#accountForm')){
  const form=$('#accountForm');
  const photo=window.VideiraLeadershipPhoto.bind(form,()=>busy,requestLeadershipPhoto);
  const submit=form.querySelector('.actions.wide button');
  const networks=()=>{const role=form.elements.role.value,global=['master','supervisor','supervisora_kids'].includes(role),old=form.elements.network_id.value,church=form.elements.church_id.value,building=role==='predio',optional=(role==='obreiro'&&!memberForLeaderAccess)||building||global;form.elements.church_id.parentElement.hidden=global;form.elements.network_id.parentElement.hidden=global||building;form.elements.church_id.disabled=global;form.elements.church_id.required=!global;form.elements.network_id.disabled=global||building;form.elements.network_id.required=!optional;form.elements.network_id.innerHTML=`<option value="">${global?'Todas as redes':optional?'Toda a igreja':'Selecione a rede'}</option>`+(global?'':db.networks.filter(n=>n.church_id===church&&(role!=='supervisora_kids'||n.kind==='kids')).map(n=>`<option value="${n.id}">${esc(n.name)}</option>`).join(''));if(!global&&Array.from(form.elements.network_id.options).some(option=>option.value===old))form.elements.network_id.value=old;$('#accountScope').textContent=role==='master'?'Master: acesso administrativo completo na organização, incluindo criação de contas.':role==='supervisor'?'Pastor Supervisor: acompanha todas as igrejas, redes e células da organização. Não cria contas Master.':role==='predio'?'Pastor de Prédio: gere todas as redes e células da igreja selecionada.':role==='supervisora_kids'?'Pastora Supervisora: acompanha as Redes Kids de todas as igrejas.':role==='pastor'?'Pastor de Rede: acompanha as células da rede selecionada.':role==='obreiro'?(db.networks.find(n=>n.id===form.elements.network_id.value)?.kind==='kids'?'Obreiro: acompanha somente a Rede Kids selecionada.':'Obreiro: acompanha as células da igreja selecionada.'):'Após criar o acesso, vincule esta pessoa como líder ou discipulador na aba Células. Até o vínculo, o painel ficará sem células.';};
  const linkedMember=memberForLeaderAccess;
  if(linkedMember){
   form.elements.display_name.value=linkedMember.full_name;
   form.elements.display_name.readOnly=true;
   form.elements.birth_date.value=linkedMember.birth_date||'';
   form.elements.birth_date.readOnly=true;
   form.elements.role.value='lider';
   for(const option of [...form.elements.role.options]){
    if(!['lider','discipulador','pastor','obreiro','supervisora_kids'].includes(option.value))option.remove();
   }
   form.elements.church_id.value=db.cells.find(cell=>cell.id===linkedMember.cell_id)?.church_id||'';
   submit.textContent='Criar acesso vinculado';
  }
  if(linkedMember)form.elements.phone.value=linkedMember.phone||'';
  window.VideiraPhone.bind(form.elements.phone,{mobileOnly:true});
  const refreshNetworks=()=>{networks();updateRoleOptions(form);};
  form.elements.church_id.onchange=refreshNetworks;form.elements.role.onchange=refreshNetworks;form.elements.network_id.onchange=refreshNetworks;refreshNetworks();
  form.onsubmit=async e=>{e.preventDefault();if(busy||photo.processing)return;if(form.elements.password.value!==form.elements.confirm_password.value)return status('As senhas não coincidem.',true);const data=Object.fromEntries(new FormData(form));delete data.confirm_password;if(!assignKidsSupervisorScope(data,null,form.elements.church_id.value))return status('Cadastre uma Rede Kids para criar uma Pastora Supervisora.',true);if(linkedMember)data.member_id=linkedMember.id;busy=true;submit.disabled=true;status('Criando cadastro e acesso no Supabase…');let created;
   try{created=await call('create_account',data);let phoneFailed=false,photoFailed=false;
   if(data.phone){
    try{
     const account=await call('account_get',{id:created.id});
     await call('account_save',{...account,id:created.id,phone:data.phone});
    }catch{phoneFailed=true}
   }if(photo.value){try{await requestLeadershipPhoto(created.id,photo.value)}catch{photoFailed=true}}memberForLeaderAccess=null;form.reset();await reload();render();status(phoneFailed||photoFailed?`Conta criada. Abra Editar conta para salvar ${phoneFailed&&photoFailed?'o telefone e a foto':phoneFailed?'o telefone':'a foto'}.`:`Acesso ${created.username} criado. Para líderes e discipuladores, confira o vínculo na aba Células.`,phoneFailed||photoFailed)}catch(error){status(created?'O acesso foi criado, mas a lista não pôde ser atualizada. Recarregue e entre novamente antes de repetir o cadastro.':error.uncertain?'Não foi possível confirmar o resultado. Confira a lista e, se necessário, o Supabase antes de repetir o cadastro.':error.message,true);form.elements.password.value='';form.elements.confirm_password.value='';submit.disabled=false}finally{data.password='';busy=false}
  };
 }
 if($('#entityForm')){
  const form=$('#entityForm');
  if(view==='person')window.VideiraPhone.bind(form.elements.phone);
  if(edit){for(const name of (view==='cell'?['church_id','network_id']:view==='network'?['church_id']:[]))form.elements[name].disabled=true}
  if(view==='cell'){
   const updateScheduleRequirement=()=>{
    const required=form.elements.is_paused.value!=='true'&&!db.cells.find(c=>c.id===edit)?.meeting_schedule;
    form.elements.meeting_weekday.required=required;
    form.elements.meeting_time.required=required;
   };
   form.elements.is_paused.onchange=updateScheduleRequirement;
   updateScheduleRequirement();
   const links=()=>{const church=form.elements.church_id.value,network=form.elements.network_id.value;for(const [key,match] of [['leader_id',p=>['master','supervisor'].includes(p.role)||p.role==='predio'&&p.church_id===church||['lider','discipulador','pastor'].includes(p.role)&&p.church_id===church&&p.network_id===network],['discipler_id',p=>p.role==='discipulador'&&p.church_id===church&&p.network_id===network]]){const old=form.elements[key].value,choices=db.profiles.filter(p=>p.active&&match(p));form.elements[key].innerHTML='<option value="">A definir</option>'+choices.map(p=>`<option value="${p.id}">${esc(p.display_name)} · ${roles[p.role]}</option>`).join('');if(choices.some(p=>p.id===old))form.elements[key].value=old;}};
   if(!edit){if(db.churches.length===1)form.elements.church_id.value=db.churches[0].id;const update=()=>{const church=form.elements.church_id.value;form.elements.network_id.innerHTML='<option value="">Selecione</option>'+db.networks.filter(x=>x.church_id===church).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');if(form.elements.network_id.options.length===2)form.elements.network_id.selectedIndex=1;links()};form.elements.church_id.onchange=update;update()}
   form.elements.network_id.onchange=links;links();
  }
  const memberPhoto=view==='person'?bindMemberPhoto(form,edit):null;
  const locationControl=view==='cell'?window.VideiraLocation.bind(form,edit?db.cells.find(c=>c.id===edit):{}, {resolveMaps:url=>call('resolve_maps',{url})}):null;
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;if(locationControl){status('Conferindo localização…');await locationControl.wait();if(!form.isConnected||busy)return;}const data=Object.fromEntries(new FormData(form));if(edit)data.id=edit;if(memberPhoto){
   if(memberPhoto.processing)return status('Aguarde a preparação da foto.',true);
   if(edit)data.original_cell_id=db.people.find(person=>person.id===edit).cell_id;
   if(memberPhoto.image)data.photo_base64=memberPhoto.image;
  }if(view==='cell'){try{
   const previous=db.cells.find(c=>c.id===edit)?.meeting_schedule||'';
   if(data.is_paused==='true'&&!data.meeting_weekday&&!data.meeting_time){
    data.meeting_schedule=previous||null;
    delete data.meeting_weekday;
    delete data.meeting_time;
   }else data.meeting_schedule=window.VideiraWeekly.read(data,previous);
  }catch(e){return status(e.message,true)}}if(view==='cell'&&Boolean(data.latitude)!==Boolean(data.longitude))return status('Informe latitude e longitude juntas.',true);if(locationControl){Object.assign(data,locationControl.read());for(const k of ['postal_code','street','house_number','complement','neighborhood','city','state','legacy_address'])delete data[k];}save(view,data)};
 }
 if($('#meetingForm')){const form=$('#meetingForm'),entry=$('#meetingEntry'),cards=[...document.querySelectorAll('[data-meeting-cell]')];
  const trainee=$('#cellTrainee'),traineeSelect=$('#cellTraineeSelect'),traineeButton=$('#saveCellTrainee'),traineeStatus=$('#cellTraineeStatus');
  const showTrainee=cell=>{
   trainee.hidden=cell.leader_id!==db.profile.id;
   traineeStatus.textContent='';
   traineeSelect.innerHTML='<option value="">Nenhum membro selecionado</option>'+
    db.people.filter(p=>p.cell_id===cell.id&&p.category==='Membro')
     .map(p=>`<option value="${esc(p.id)}">${esc(p.full_name)}</option>`).join('');
   traineeSelect.value=db.cell_trainees?.[cell.id]||'';
  };
  traineeButton.onclick=async()=>{
   if(busy||trainee.hidden)return;
   const id=form.elements.cell_id.value;
   busy=true;
   traineeButton.disabled=traineeSelect.disabled=true;
   traineeStatus.textContent='Salvando…';
   try{
    const saved=await call('cell_trainee',{cell_id:id,person_id:traineeSelect.value||null});
    db.cell_trainees??={};
    db.cell_trainees[id]=saved.person_id;
    traineeStatus.textContent=saved.person_id?'Líder em treinamento salvo.':'Seleção removida.';
   }catch(error){traineeStatus.textContent=error.message}
   finally{busy=false;traineeButton.disabled=traineeSelect.disabled=false}
  };
  const close=()=>{entry.hidden=true;form.reset();cards.forEach(b=>b.setAttribute('aria-pressed','false'))};
  cards.forEach(button=>button.onclick=()=>{const cell=meetingCells().find(c=>c.id===button.dataset.meetingCell);if(!cell||busy)return;form.reset();form.elements.cell_id.value=cell.id;showTrainee(cell);const suggested=window.VideiraWeekly.suggest(cell.meeting_schedule||'',db.meetings.filter(m=>m.cell_id===cell.id));form.elements.date.value=suggested.date;$('#changeMeetingDate').open=false;const showDate=()=>{$('#meetingDateDisplay').textContent=form.elements.date.value.split('-').reverse().join('/')||'Selecione a data'};showDate();form.elements.date.onchange=showDate;form.elements.date.min=suggested.min;form.elements.date.max=suggested.max;form.elements.date.setAttribute('aria-describedby','meetingDateHelp');$('#meetingDateHelp').textContent=suggested.message;$('#meetingCellTitle').textContent=cell.name;$('#meetingCellSchedule').textContent=cell.meeting_schedule||'Dia e horário ainda não informados';const people=db.people.filter(p=>p.cell_id===cell.id);$('#attendance').innerHTML=people.map(p=>`<label class="check"><input type="checkbox" name="present" value="${esc(p.id)}"><span class="attendance-avatar" data-person-photo="${esc(p.id)}" aria-hidden="true">${esc(personInitials(p.full_name))}</span><span>${esc(p.full_name)} <small>· ${esc(p.category)}</small></span></label>`).join('')||'<p>Cadastre as pessoas desta célula antes de fazer a chamada.</p>';$('#saveMeeting').disabled=!people.length||Boolean(suggested.min&&suggested.date<suggested.min);$('#markAll').disabled=!people.length;cards.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));entry.hidden=false;loadPersonPhotos($('#attendance'));$('#meetingCellTitle').setAttribute('tabindex','-1');$('#meetingCellTitle').focus();entry.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})});
  $('#closeMeeting').onclick=()=>{if(busy)return;const selected=cards.find(b=>b.getAttribute('aria-pressed')==='true');close();selected?.focus()};
  $('#markAll').onclick=()=>form.querySelectorAll('[name=present]').forEach(x=>x.checked=true);
  form.onsubmit=e=>{e.preventDefault();if(busy)return;const id=form.elements.cell_id.value;if(!meetingCells().some(c=>c.id===id))return status('Selecione uma célula disponível para sua chamada.',true);const people=db.people.filter(p=>p.cell_id===id);if(!people.length)return status('Cadastre as pessoas desta célula antes de registrar o encontro.',true);if(!form.elements.date.value||form.elements.date.value<form.elements.date.min||form.elements.date.value>window.VideiraWeekly.today())return status('Confira a data: a chamada não pode ser futura, repetida ou anterior à última chamada.',true);const checked=new Set([...form.querySelectorAll('[name=present]:checked')].map(x=>x.value));const data={cell_id:id,date:form.elements.date.value,attendance:people.map(p=>({person_id:p.id,present:checked.has(p.id)}))};save('meeting',data)};
 }
 document.querySelectorAll('[data-call-archive]').forEach(button=>button.onclick=async()=>{if(busy)return;const restore=button.dataset.restore==='true';if(!confirm(restore?'Restaurar esta chamada nos relatórios?':'Excluir esta chamada dos relatórios? Você poderá restaurá-la em Chamadas excluídas.'))return;busy=true;button.disabled=true;try{await call('meeting_archive',{id:button.dataset.callArchive,restore});await reload();render();status(restore?'Chamada restaurada.':'Chamada excluída. Disponível em Chamadas excluídas.')}catch(e){status(e.message,true);button.disabled=false}finally{busy=false}});
 if(view==='reports')window.VideiraPersonReports.mount($('#personReports'),db,call,esc);
}
async function save(action,data){busy=true;document.querySelectorAll('form button').forEach(b=>b.disabled=true);status('Salvando no Supabase…');try{const result=await call(action,data);
 if(action==='person')avatarRequests.clear();
 if(action==='cell'){
  try{localStorage.setItem('videira-public-cells-changed',String(Date.now()))}catch{}
 }
 await reload();edit=null;render();status(action==='meeting'?`Encontro salvo. ${result.present} presente(s).`:'Cadastro salvo no Supabase.')}catch(e){status(e.message,true);document.querySelectorAll('form button').forEach(b=>b.disabled=false)}finally{busy=false}}
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
 if(!session){document.documentElement.classList.remove('restoring-management');return}
 sessionStore=readSession(sessionStorage)?sessionStorage:localStorage;
 busy=true;
 loginButton.disabled=true;
 status('Restaurando sessão…');
 try{await reload();render()}catch(error){
  if(error.status===401)clearSession();
  status(error.message,true);
  loginButton.disabled=false;
 }finally{busy=false;document.documentElement.classList.remove('restoring-management')}
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
