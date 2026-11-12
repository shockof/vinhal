'use strict';
(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${({cells:'<circle cx="12" cy="6" r="3"/><circle cx="5" cy="16" r="3"/><circle cx="19" cy="16" r="3"/><path d="M10 9l-3 4m7-4 3 4M8 17h8"/>',people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0112 0v4M17 4a3 3 0 010 6m1 4a5 5 0 013 5v2"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h3m2 0h3"/>',chart:'<path d="M4 21V11h4v10m3 0V4h4v17m3 0V8h4v13M2 21h22"/>'})[name]}</svg>`;
const pct=att=>att.length?Math.round(att.filter(a=>a.present===true).length*100/att.length):null;
const rate=n=>n===null?'—':n+'%';
function summarize(db,{from='',to='',church='',network='',cell=''}={}){
 const cells=db.cells.filter(c=>(!church||c.church_id===church)&&(!network||c.network_id===network)&&(!cell||c.id===cell)),ids=new Set(cells.map(c=>c.id));
 const meetings=db.meetings.filter(m=>ids.has(m.cell_id)&&(!from||m.meeting_date>=from)&&(!to||m.meeting_date<=to)),mids=new Set(meetings.map(m=>m.id)),attendance=db.attendance.filter(a=>mids.has(a.meeting_id)),people=db.people.filter(p=>ids.has(p.cell_id));
 const groups=cells.map(c=>{const m=new Set(meetings.filter(m=>m.cell_id===c.id).map(m=>m.id)),att=attendance.filter(a=>m.has(a.meeting_id));return {...c,frequency:pct(att),meetings:m.size,people:people.filter(p=>p.cell_id===c.id).length}});
 const months=new Map();for(const m of meetings){const key=m.meeting_date.slice(0,7);if(!months.has(key))months.set(key,[])}
 for(const a of attendance){const m=meetings.find(m=>m.id===a.meeting_id);months.get(m.meeting_date.slice(0,7)).push(a)}
 return {cells,meetings,attendance,people,groups,frequency:pct(attendance),present:attendance.filter(a=>a.present===true).length,absent:attendance.filter(a=>a.present!==true).length,members:people.filter(p=>p.category==='Membro').length,visitors:people.filter(p=>p.category==='Visitante').length,months:[...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,a])=>({month,frequency:pct(a)}))};
}
function cards(s,clickable=false,filter={}){
 const metrics=[
  ['cells',s.cells.length,'cells','violet'],
  ['members',s.members,'people','blue'],
  ['frequency',rate(s.frequency),'check','green'],
  ['visitors',s.visitors,'calendar','orange']
 ];
 return `<div class="dash-metrics">${metrics.map(([key,value,iconName,color])=>{
  const content=`${icon(iconName)}<span class="dash-metric-copy"><strong>${value}</strong><span>${metricTitles[key]}</span></span>`;
  const query=new URLSearchParams({metric:key});
  for(const name of ['from','to','church'])if(filter[name])query.set(name,filter[name]);
  return clickable?`<a class="dash-metric ${color}" data-dash-metric="${key}" href="gestao.html?${esc(query)}" aria-label="${metricTitles[key]}, ${value}">${content}</a>`:
   `<article class="dash-metric ${color}">${content}</article>`;
 }).join('')}</div>`;
}
function trend(s){const points=s.months.slice(-12),valid=points.filter(p=>p.frequency!==null);if(!valid.length)return '<div class="dash-empty">Registre presenças para acompanhar a evolução mensal.</div>';
 const x=i=>48+(points.length===1?125:i*266/(points.length-1)),y=n=>152-n*1.25;
 const lines=points.map((p,i)=>p.frequency===null?'':`${i===0||points[i-1].frequency===null?'M':'L'}${x(i)},${y(p.frequency)}`).join(' ');
 return `<svg class="dash-trend" viewBox="0 0 340 200" role="img" aria-label="Frequência mensal: ${valid.map(p=>esc(p.month)+' '+p.frequency+'%').join(', ')}">${[0,25,50,75,100].map(n=>`<line x1="45" y1="${y(n)}" x2="320" y2="${y(n)}" stroke="#ebe6f6"/><text x="5" y="${y(n)+4}">${n}%</text>`).join('')}<path d="${lines}" fill="none" stroke="#7546d3" stroke-width="3"/>${points.map((p,i)=>`${p.frequency===null?'':`<circle cx="${x(i)}" cy="${y(p.frequency)}" r="5" fill="#7546d3"/>${points.length<=6||i===points.length-1?`<text class="dash-point" x="${x(i)}" y="${y(p.frequency)-12}" text-anchor="middle">${p.frequency}%</text>`:''}`}${i%Math.ceil(points.length/6)===0||i===points.length-1?`<text x="${x(i)}" y="179" text-anchor="middle">${p.month.slice(5)}/${p.month.slice(2,4)}</text>`:''}`).join('')}</svg><p class="dash-footnote">Meses com encontros registrados. Frequência = presenças ÷ registros de chamada.</p>`;
}
function donut(s){return `<div class="dash-donut-wrap"><div class="dash-donut" style="--frequency:${s.frequency??0}%" role="img" aria-label="${s.attendance.length?rate(s.frequency)+' dos registros com presença':'Sem chamada no período'}"><div><strong>${rate(s.frequency)}</strong><span>Frequência</span></div></div></div><div class="dash-legend"><span><i></i>Presenças <b>${s.present}</b></span><span><i></i>Ausências <b>${s.absent}</b></span></div><p class="dash-footnote">${s.meetings.length} encontro(s) no período · ${s.attendance.length} registros de chamada. Presenças podem incluir a mesma pessoa em encontros diferentes.</p>`}
function cellRows(s,db){if(!s.groups.length)return '<div class="dash-empty">Nenhuma célula vinculada ao seu perfil.</div>';return `<div class="dash-cell-list">${s.groups.map((c,i)=>`<button class="dash-cell" data-dash-cell="${esc(c.id)}"><span class="dash-cell-badge">${String(i+1).padStart(2,'0')}</span><span class="dash-cell-name"><b>${esc(c.name)}</b><small>Líder: ${esc(leadershipName(db,c.leader_id))}</small><small>${c.people} pessoa(s) · ${c.meetings} encontro(s)</small></span><span class="dash-cell-rate"><b>${rate(c.frequency)}</b><small>Frequência</small><span class="dash-track"><i style="width:${c.frequency??0}%"></i></span></span><span aria-hidden="true">›</span></button>`).join('')}</div>`}
function leadershipName(db,id,fallback='A definir'){return (db.cell_leadership||[]).find(p=>p.id===id)?.display_name||db.profiles.find(p=>p.id===id)?.display_name||(id?'Responsável vinculado':fallback)}
function hierarchy(s,db){const byLeader=db.profile.role==='discipulador',key=byLeader?'leader_id':'discipler_id',groups=new Map();for(const cell of s.groups){const id=cell[key]||'';if(!groups.has(id))groups.set(id,{id,name:id?leadershipName(db,id):byLeader?'Sem líder vinculado':'Sem discipulador vinculado',cells:[]});groups.get(id).cells.push(cell)}return [...groups.values()].sort((a,b)=>!a.id?1:!b.id?-1:a.name.localeCompare(b.name,'pt-BR')).map(group=>{const ids=new Set(group.cells.map(c=>c.id)),meetings=new Set(s.meetings.filter(m=>ids.has(m.cell_id)).map(m=>m.id));return {...group,frequency:pct(s.attendance.filter(a=>meetings.has(a.meeting_id))),people:s.people.filter(p=>ids.has(p.cell_id)).length}})}
function groupedCells(s,db){if(db.profile.role==='lider')return cellRows({...s,groups:s.groups.filter(c=>c.leader_id===db.profile.id)},db);const groups=hierarchy(s,db);if(!groups.length)return '<div class="dash-empty">Nenhuma célula vinculada ao seu perfil.</div>';return `<div class="dash-hierarchy">${groups.map((g,i)=>`<details class="dash-person-group"><summary><span class="dash-cell-badge">${String(i+1).padStart(2,'0')}</span><span class="dash-group-name"><b>${esc(g.name)}</b><small>${db.profile.role==='discipulador'?'Líder':'Discipulador (a)'} · ${g.cells.length} ${g.cells.length===1?'célula':'células'} · ${g.people} pessoa(s)</small></span><span class="dash-cell-rate"><b>${rate(g.frequency)}</b><small>Frequência</small></span><span class="dash-expand" aria-hidden="true">⌄</span></summary><div class="dash-group-cells">${cellRows({...s,groups:g.cells},db)}</div></details>`).join('')}</div>`}
function networkBars(s,db){const ids=new Set(s.cells.map(c=>c.network_id)),networks=db.networks.filter(n=>ids.has(n.id));if(!networks.length)return '<div class="dash-empty">Cadastre redes e células para comparar a frequência.</div>';return `<div class="dash-bars">${networks.map(n=>{const ids=new Set(s.meetings.filter(m=>s.cells.some(c=>c.id===m.cell_id&&c.network_id===n.id)).map(m=>m.id)),nrate=pct(s.attendance.filter(a=>ids.has(a.meeting_id)));return `<div><span>${esc(n.name)}<small>${esc(db.churches.find(c=>c.id===n.church_id)?.name||'')}</small></span><span class="dash-track"><i style="width:${nrate??0}%"></i></span><b>${rate(nrate)}</b></div>`}).join('')}</div>`}
const metricRoles=new Set(['master','supervisor','pastor','obreiro','predio','discipulador']);
const allChurchRoles=new Set(['master','supervisor']);
const metricTitles={cells:'Células no seu escopo',members:'Membros cadastrados',frequency:'Frequência no período',visitors:'Visitantes cadastrados'};
const compareNames=(a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'});

function metricScope(db){
 if(db.profile.role!=='discipulador')return db;
 return {...db,cells:db.cells.filter(cell=>cell.discipler_id===db.profile.id)};
}

function cellGroupName(db,key,id){
 if(key==='discipler_id')return leadershipName(db,id,'Sem discipulador vinculado');
 if(key==='leader_id')return leadershipName(db,id,'Sem líder vinculado');
 const records={church_id:db.churches,network_id:db.networks,id:db.cells};
 const fallback={church_id:'Igreja',network_id:'Rede',id:'Célula'};
 const record=records[key].find(item=>item.id===id);
 if(key==='network_id'&&record&&allChurchRoles.has(db.profile.role)){
  const church=db.churches.find(item=>item.id===record.church_id);
  if(church)return record.name+' · '+church.name;
 }
 return record?.name||fallback[key];
}

function mountDirectory(root,db,kind,filter){
 const isCells=kind==='cells';
 const select=(key,label)=>`<label>${label}<select name="${key}"></select></label>`;
 root.innerHTML=`<section class="metric-directory">
  <div class="directory-filters">
   <label>Busca<input type="search" placeholder="${isCells?'Buscar célula ou líder':'Buscar nome ou célula'}"></label>
   ${select('church_id','Igreja')}
   ${select('network_id','Rede')}
   ${select('discipler_id','Discipulador')}
  </div>
  <div class="directory-results"></div>
  <p class="directory-count" role="status"></p>
 </section>`;
 const body=root.querySelector('.directory-results');
 const count=root.querySelector('.directory-count');
 const search=root.querySelector('input[type=search]');
 const fields=[...root.querySelectorAll('select')];
 const allLabels={church_id:'Todas as igrejas',network_id:'Todas as redes',discipler_id:'Todos os discipuladores'};
 const normalize=value=>String(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 const source=new Map(db.cells.map(cell=>[cell.id,cell]));
 const rows=isCells?db.cells.map(cell=>({name:cell.name,cell})):
  db.people.filter(person=>person.category===(kind==='members'?'Membro':'Visitante')&&source.has(person.cell_id))
   .map(person=>({name:person.full_name,cell:source.get(person.cell_id)}));
 rows.sort((a,b)=>compareNames(a.name,b.name)||compareNames(a.cell.name,b.cell.name));
 const label=(key,id)=>key==='network_id'?db.networks.find(n=>n.id===id)?.name||'Rede':cellGroupName(db,key,id);
 const update=()=>{
  let cells=db.cells;
  for(const field of fields){
   const key=field.name;
   const selected=field.options.length?field.value:key==='church_id'?filter.church:'';
   const ids=[...new Set(cells.map(cell=>cell[key]||'__unassigned__'))];
   const name=id=>label(key,id==='__unassigned__'?'':id);
   ids.sort((a,b)=>compareNames(name(a),name(b)));
   field.innerHTML=`<option value="">${allLabels[key]}</option>`+ids.map(id=>`<option value="${esc(id)}">${esc(name(id))}</option>`).join('');
   field.value=ids.includes(selected)?selected:'';
   if(field.value)cells=cells.filter(cell=>(cell[key]||'__unassigned__')===field.value);
  }
  const ids=new Set(cells.map(cell=>cell.id));
  const query=normalize(search.value.trim());
  const filtered=rows.filter(({name,cell})=>ids.has(cell.id)&&
   [name,cell.name,leadershipName(db,cell.leader_id)].some(value=>normalize(value).includes(query)));
  const noun=isCells?'célula':kind==='members'?'membro':'visitante';
  count.textContent=`${filtered.length} ${noun}${filtered.length===1?'':'s'}`;
  if(!filtered.length){
   body.innerHTML='<p class="dash-empty">Nenhum resultado para os filtros selecionados.</p>';
   return;
  }
  const headers=[isCells?'Célula':'Nome',...(isCells?[]:['Célula']),'Igreja','Rede','Discipulador',...(isCells?['Líder','Detalhes']:[])];
  body.innerHTML=`<table class="directory-table"><thead><tr>${headers.map(text=>`<th scope="col">${text}</th>`).join('')}</tr></thead>
   <tbody>${filtered.map(({name,cell})=>{
    const values=[name,...(isCells?[]:[cell.name]),label('church_id',cell.church_id),label('network_id',cell.network_id),
     label('discipler_id',cell.discipler_id),...(isCells?[leadershipName(db,cell.leader_id)]:[])];
    return `<tr>${values.map((value,index)=>`<td data-label="${headers[index]}">${headers[index]==='Rede'?`<span class="directory-network">${esc(value)}</span>`:esc(value)}</td>`).join('')}
     ${isCells?`<td class="directory-action"><button class="secondary" type="button" data-directory-cell="${esc(cell.id)}" aria-label="Ver detalhes de ${esc(cell.name)}">›</button></td>`:''}</tr>`;
   }).join('')}</tbody></table>`;
  body.querySelectorAll('[data-directory-cell]').forEach(button=>button.onclick=()=>{
   const cell=source.get(button.dataset.directoryCell);
   const detail=root.querySelector('.directory-cell-detail');
   const summary=summarize(db,{from:filter.from,to:filter.to,cell:cell.id});
   detail.hidden=false;
   detail.innerHTML=`<h2 tabindex="-1">${esc(cell.name)}</h2><p>${esc(cell.meeting_schedule||'Encontro a definir')}</p>
    ${cards(summary)}<div class="dash-grid"><article class="dash-panel"><h3>Frequência mensal</h3>${trend(summary)}</article><article class="dash-panel"><h3>Participação no período</h3>${donut(summary)}</article></div>`;
   detail.querySelector('h2').focus();
  });
 };
 for(const field of fields)field.onchange=()=>{root.querySelector('.directory-cell-detail').hidden=true;update()};
 search.oninput=()=>{root.querySelector('.directory-cell-detail').hidden=true;update()};
 root.insertAdjacentHTML('beforeend','<section class="directory-cell-detail" hidden></section>');
 update();
}

function frequencyDetails(dialog,db,initial){
 const role=db.profile.role;
 const global=allChurchRoles.has(role);
 const discipler=role==='discipulador';
 const fixed=(label,value)=>`<div class="metric-fixed"><span>${label}</span><strong>${esc(value)}</strong></div>`;
 const select=(key,label)=>`<label>${label}<select name="${key}"></select></label>`;
 const church=db.profile.church_id||db.cells[0]?.church_id;
 const network=db.profile.network_id;
 dialog.querySelector('.metric-details-body').innerHTML=`
  <div class="metric-filters">
   ${global?select('church_id','Igreja'):fixed('Igreja',church?cellGroupName(db,'church_id',church):'Sem igreja vinculada')}
   ${discipler?fixed('Rede',network?cellGroupName(db,'network_id',network):'Sem rede vinculada'):select('network_id','Rede')}
   ${discipler?fixed('Discipulado',db.profile.display_name):select('discipler_id','Discipulador')}
   ${discipler?select('leader_id','Líder'):''}
  </div>
  <div class="metric-frequency-result" aria-live="polite"></div>`;
 const result=dialog.querySelector('.metric-frequency-result');
 const fields=[...dialog.querySelectorAll('.metric-filters select')];
 const emptyLabels={church_id:'Todas as igrejas',network_id:'Todas as redes',discipler_id:'Todos os discipuladores',leader_id:'Todos os líderes'};
 const update=()=>{
  let cells=db.cells;
  for(const field of fields){
   const key=field.name;
   const selected=field.value||(field.options.length===0&&key==='church_id'?initial.church:'');
   const ids=key==='church_id'?db.churches.map(church=>church.id):
    [...new Set(cells.map(cell=>cell[key]||'__unassigned__'))];
   const name=id=>id==='__unassigned__'?cellGroupName(db,key,''):cellGroupName(db,key,id);
   ids.sort((a,b)=>compareNames(name(a),name(b)));
   field.innerHTML=`<option value="">${emptyLabels[key]}</option>`+ids.map(id=>
    `<option value="${esc(id)}">${esc(name(id))}</option>`).join('');
   field.value=ids.includes(selected)?selected:'';
   if(field.value)cells=cells.filter(cell=>(cell[key]||'__unassigned__')===field.value);
  }
  const period={from:initial.from,to:initial.to};
  const s=summarize({...db,cells},period);
  result.innerHTML=`<div class="dash-grid">
   <article class="dash-panel"><h3>Evolução da frequência</h3>${trend(s)}</article>
   <article class="dash-panel"><h3>Participação no período</h3>${donut(s)}</article>
  </div><h3>Frequência por célula</h3>${cellRows(s,db)}`;
  bind(result,db,period);
 };
 for(const field of fields)field.onchange=update;
 update();
}

function metricTitle(db,kind){
 return metricRoles.has(db.profile.role)&&Object.hasOwn(metricTitles,kind)?metricTitles[kind]:'';
}

function mountMetric(root,db,kind,filter){
 if(!metricTitle(db,kind)){
  root.textContent='Este indicador não está disponível para o seu perfil.';
  return;
 }
 const scoped=metricScope(db);
 root.innerHTML='<div class="metric-details-body"></div>';
 if(kind==='frequency')frequencyDetails(root,scoped,filter);
 else mountDirectory(root.querySelector('.metric-details-body'),scoped,kind,filter);
}

function visuals(db,filter={},showBirthdays=false){const s=summarize(db,filter),global=['master','supervisor','predio'].includes(db.profile.role);return `${cards(showBirthdays&&db.profile.role==='discipulador'?summarize(metricScope(db),filter):s,showBirthdays&&metricRoles.has(db.profile.role),filter)}${showBirthdays?'<section class="dash-panel birthday-panel" id="birthdaysPanel"><h2>Aniversariantes do mês</h2><p role="status">Carregando aniversariantes…</p></section>':''}<div class="dash-grid"><article class="dash-panel"><div class="dash-panel-title"><h2>${global?'Desempenho das redes':db.profile.role==='discipulador'?'Células por líder':db.profile.role==='lider'?'Minhas células':'Células por discipulador'}</h2><span>${global?db.networks.filter(n=>s.cells.some(c=>c.network_id===n.id)).length+' redes':s.cells.length+' células'}</span></div>${global?networkBars(s,db):groupedCells(s,db)}</article><article class="dash-panel"><h2>Evolução da frequência</h2>${trend(s)}</article></div><div class="dash-grid dash-bottom"><article class="dash-panel"><h2>${global?'Células por discipulador':'Células do seu escopo'}</h2>${global?groupedCells(s,db):`<p class="dash-explainer">Acompanhe cada célula e abra os detalhes para conferir seus indicadores. Os números de membros e visitantes representam o cadastro atual.</p><div class="actions"><button data-view="reports">Ver relatório completo →</button><button class="secondary" data-view="meeting">Registrar presença</button></div>`}</article><article class="dash-panel"><h2>Resumo da participação</h2>${donut(s)}</article></div>`}
function title(role){return ({master:'Visão geral da igreja',supervisor:'Relatórios gerais',predio:'Minha igreja',pastor:'Minha rede',obreiro:'Minha igreja',discipulador:'Minhas células',lider:'Minha célula'})[role]||'Visão geral'}
function startDate(period){if(period==='all')return '';const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Maceio'}),[year,month]=today.split('-').map(Number);const date=new Date(Date.UTC(year,month-Number(period),1));return date.toISOString().slice(0,10)}
function overview(db){return `<section class="dashboard"><div class="dash-toolbar"><div><span class="dash-eyebrow">ACOMPANHAMENTO DE CÉLULAS</span><h1>${icon('cells')}${title(db.profile.role)}</h1><p>Uma visão do cuidado e da participação no seu escopo.</p></div><label>Período da chamada<select id="dashboardPeriod"><option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option><option value="all">Todo o histórico</option></select></label></div>${db.profile.role==='supervisor'?`<div class="dash-church-filter"><label>Filtrar por igreja<select id="dashboardChurch"><option value="">Todas as igrejas</option>${db.churches.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><p>Os indicadores e gráficos acompanham a igreja selecionada.</p></div>`:''}<div id="dashboardVisuals">${visuals(db,{from:startDate('3')},true)}</div><p class="dash-footnote">Dados reais do seu escopo · Cadastros atuais e chamadas no período escolhido. Nenhum dado de exemplo é incluído.</p></section>`}
function details(db,id,filter){const c=db.cells.find(c=>c.id===id);if(!c)return;const s=summarize(db,{...filter,cell:id}),d=document.createElement('dialog');d.className='dash-dialog';d.innerHTML=`<div class="dash-dialog-head"><div><span class="dash-eyebrow">DETALHES DA CÉLULA</span><h2>${esc(c.name)}</h2></div><button class="secondary" data-close aria-label="Fechar detalhes">Fechar ×</button></div><div class="dash-details-meta"><p><span>Líder</span><b>${esc(leadershipName(db,c.leader_id))}</b></p><p><span>Rede</span><b>${esc(db.networks.find(n=>n.id===c.network_id)?.name||'—')}</b></p><p><span>Igreja</span><b>${esc(db.churches.find(n=>n.id===c.church_id)?.name||'—')}</b></p><p><span>Encontro</span><b>${esc(c.meeting_schedule||'Não informado')}</b></p></div>${cards(s)}<div class="dash-grid"><article class="dash-panel"><h2>Frequência mensal</h2>${trend(s)}</article><article class="dash-panel"><h2>Participação no período</h2>${donut(s)}</article></div>`;document.body.append(d);d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove(),{once:true});d.showModal()}
function bind(root,db,filter={}){
 root.querySelectorAll('[data-dash-cell]').forEach(button=>button.onclick=()=>details(db,button.dataset.dashCell,filter));
}
window.VideiraDashboard={overview,visuals,bind,summarize,title,startDate,hierarchy,metricTitle,mountMetric};
})();
