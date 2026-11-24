'use strict';
window.VideiraWorship=(()=>{
 const reportRoles=new Set(['master','supervisor','supervisora_kids','predio','pastor','obreiro','discipulador']);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Maceio',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const serviceOptions='<option value="morning">Culto da manhã</option><option value="evening">Culto da noite</option>';
 const options=(items,all)=>`<option value="">${all}</option>`+items.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
 const request=(call,action,data={})=>call('worship',{p_action:action,p_data:data});
 async function callPhotoSource(id,call,resolvePhoto){
  const photo=resolvePhoto?await resolvePhoto(id):(await request(call,'photo',{id}))?.photo_base64;
  if(typeof photo==='string'&&photo)return 'data:image/jpeg;base64,'+photo;
  return photo&&typeof photo.source==='string'&&photo.source?photo.source:null;
 }
 let unsaved=()=>false;
 const canLeave=()=>!unsaved()||confirm('Há marcações não salvas. Deseja sair sem salvar?');
 function message(root,text,error=false){const el=root.querySelector('.worship-status');if(el){el.textContent=text;el.classList.toggle('error',error)}}
 async function scope(root,db,call){const data=db.worship_scope||await request(call,'scope');if(!root.isConnected)return null;return data}
 async function mountCall(root,db,call,{resolvePhoto}={}){
  root.innerHTML='<p role="status">Carregando células para a chamada…</p>';
  try{
   const data=await scope(root,db,call);if(!data)return;
   const cells=data.cells.filter(c=>c.can_record);
   if(!cells.length){root.innerHTML='<article class="panel"><h2>Presença no culto</h2><p>Não há células disponíveis para chamada. O discipulador faz a chamada das células ligadas a ele. Em igrejas sem discipuladores ativos, o líder faz a chamada das próprias células.</p></article>';return}
   const master=db.profile.role==='master';
   root.innerHTML=`<p>${master?'Selecione uma célula para fazer a chamada do culto.':'Faça a chamada das células ligadas a você.'}</p><article class="panel"><form class="report-filters worship-filters"><label>Data do culto<input name="date" type="date" value="${today()}" max="${today()}" required></label><label>Culto<select name="service">${serviceOptions}</select></label><label>Célula<select name="cell" ${master?'required':''}>${options(cells,master?'Selecione uma célula':'Todas as minhas células')}</select></label><button class="worship-field-button">Carregar chamada</button></form></article><p class="notice">${master?'Master: acesso às células da organização. Chamadas salvas entram nos relatórios.':'Em igrejas sem discipuladores ativos, cada líder faz a chamada das próprias células.'}</p><p class="worship-status" role="status" aria-live="polite"></p><div class="worship-totals"></div><article class="panel"><div class="worship-list-head"><h2>Lista de chamada</h2><label>Buscar por nome<input class="worship-search" type="search" placeholder="Nome completo"></label></div><div class="worship-list"></div><div class="worship-footer"><p class="worship-pending"></p><button class="worship-save worship-field-button" disabled>Salvar chamada</button></div></article>`;
   const form=root.querySelector('form'),list=root.querySelector('.worship-list'),save=root.querySelector('.worship-save');
   let roster=null,dirty=false,loading=false,criteria=null,photoCache=new Map();
   unsaved=()=>root.isConnected&&dirty;
   function totals(){if(!roster)return;const present=roster.people.filter(p=>p.present===true).length,absent=roster.people.filter(p=>p.present===false).length,pending=roster.people.length-present-absent;
    root.querySelector('.worship-totals').innerHTML=`<span>${roster.people.length} pessoas</span><span class="worship-present">${present} ${present===1?'presente':'presentes'}</span><span class="worship-absent">${absent} ${absent===1?'falta':'faltas'}</span><span>${pending} ${pending===1?'pendente':'pendentes'}</span>`;
    root.querySelector('.worship-pending').textContent=pending?`${pending} pessoa(s) ainda sem marcação`:'Todas as pessoas foram marcadas.';
    save.disabled=loading||!roster.people.length||!!pending||!dirty;
   }
   function renderRows(){const query=root.querySelector('.worship-search').value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
    list.innerHTML=roster.people.filter(p=>p.full_name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().includes(query)).map(p=>`<div class="worship-person" data-person="${esc(p.id)}"><span class="attendance-avatar" data-avatar="${esc(p.id)}" aria-hidden="true">${esc(p.full_name.slice(0,1))}</span><div class="worship-person-name"><strong>${esc(p.full_name)}</strong><small>${esc(cells.find(c=>c.id===p.cell_id)?.name)}</small></div><span class="worship-category">${esc(p.category)}</span><fieldset><legend class="sr-only">Chamada de ${esc(p.full_name)}</legend>${[['true','Presente'],['false','Falta'],['null','Pendente']].map(([value,label])=>`<label class="worship-choice ${p.present===JSON.parse(value)?'selected':''}"><input type="radio" name="attendance-${esc(p.id)}" value="${value}" ${p.present===JSON.parse(value)?'checked':''}>${label}</label>`).join('')}</fieldset></div>`).join('')||'<p>Nenhuma pessoa encontrada.</p>';
    let index=0;const avatars=[...list.querySelectorAll('[data-avatar]')];async function photos(){while(index<avatars.length){const avatar=avatars[index++],id=avatar.dataset.avatar;if(!avatar.isConnected)return;try{if(!photoCache.has(id))photoCache.set(id,callPhotoSource(id,call,resolvePhoto).catch(()=>null));const photo=await photoCache.get(id);if(photo&&avatar.isConnected){const img=document.createElement('img');img.alt='';img.onload=()=>{if(avatar.isConnected)avatar.replaceChildren(img)};img.src=photo}}catch{}}}Promise.all([photos(),photos(),photos()]);
   }
   list.onchange=event=>{const radio=event.target.closest('input[type=radio]');if(!radio||loading)return;const row=radio.closest('[data-person]');roster.people.find(p=>p.id===row.dataset.person).present=JSON.parse(radio.value);dirty=true;for(const label of row.querySelectorAll('.worship-choice'))label.classList.toggle('selected',label.contains(radio));totals()};
   root.querySelector('.worship-search').oninput=()=>{if(roster)renderRows()};
   async function load(){if(loading)return;if(dirty&&!confirm('Descartar as marcações não salvas e carregar outra chamada?')){if(criteria)for(const [key,value] of Object.entries(criteria))form.elements[key].value=value;return}
    loading=true;form.inert=true;form.querySelector('button').disabled=true;save.disabled=true;list.inert=true;message(root,'Carregando chamada…');
    try{const selected=Object.fromEntries(new FormData(form));const loaded=await request(call,'roster',selected);if(!root.isConnected)return;criteria=selected;roster=loaded;dirty=false;renderRows();message(root,roster.people.length?'Chamada carregada. Marque presença ou falta para cada pessoa.':'Não há pessoas cadastradas nessas células.')}
    catch(error){if(criteria)for(const [key,value] of Object.entries(criteria))form.elements[key].value=value;message(root,error.message,true)}finally{loading=false;form.inert=false;form.querySelector('button').disabled=false;list.inert=false;totals()}
   }
   form.onsubmit=e=>{e.preventDefault();load()};form.onchange=()=>{if(form.reportValidity())load()};
   save.onclick=async()=>{if(save.disabled||loading||!criteria)return;loading=true;save.disabled=true;form.inert=true;list.inert=true;message(root,'Salvando chamada…');
    const groups=roster.calls.filter(c=>roster.people.some(p=>p.cell_id===c.cell_id)).map(c=>({...c,people:roster.people.filter(p=>p.cell_id===c.cell_id).map(p=>({person_id:p.id,present:p.present}))}));
    try{await request(call,'save',{...criteria,calls:groups});dirty=false;message(root,'Chamada salva com sucesso.');roster=await request(call,'roster',criteria);if(root.isConnected)renderRows()}
    catch(error){message(root,error.message,true)}finally{loading=false;form.inert=false;list.inert=false;totals()}
   };
   if(master)list.innerHTML='<p>Selecione uma célula e carregue a chamada.</p>';else await load();
  }catch(error){root.innerHTML=`<p role="alert">${esc(error.message||'Não foi possível abrir a chamada.')}</p>`}
 }
 function download(filename,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 function spreadsheet(rows){const headers=['Nome completo','Telefone','Categoria','Célula','Presenças','Faltas'];const all=[headers,...rows];
  const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const sheet=all.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" ${i&&j>3?'':'t="inlineStr"'}>${i&&j>3?`<v>${Number(v)||0}</v>`:`<is><t xml:space="preserve">${xml(v)}</t></is>`}</c>`).join('')}</row>`).join('');
  return new Blob([rxZip({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
   '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Presenças no culto" sheetId="1" r:id="rId1"/></sheets></workbook>',
   'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
   'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="4" width="23" customWidth="1"/></cols><sheetData>${sheet}</sheetData><autoFilter ref="A1:F${all.length}"/></worksheet>`})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 }
 function reportSummary(result,rows){
  const icons={people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',present:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',absent:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h1m6 0h1m-8 3h1m6 0h1"/>'};
  const cards=[['people','Pessoas no relatório',new Set(result.rows.map(r=>r.id)).size,'Membros, líderes e visitantes'],['present','Presenças',rows.reduce((sum,r)=>sum+r[4],0),'Marcações de presença'],['absent','Faltas',rows.reduce((sum,r)=>sum+r[5],0),'Ausências registradas'],['calendar','Cultos com chamada',result.services,'No período selecionado']];
  return `<div class="worship-summary-head"><h2>Resumo do período</h2><span>Presenças no culto</span></div><div class="worship-summary-grid">${cards.map(([kind,label,value,detail])=>`<article class="worship-stat worship-stat-${kind}"><span class="worship-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[kind]}</svg></span><h3>${label}</h3><strong>${Number(value)||0}</strong><p>${detail}</p></article>`).join('')}</div><p class="worship-summary-note">Presenças e faltas consideram somente as chamadas registradas no período.</p>`;
 }
 async function mountReport(root,db,call){
  root.innerHTML='<p role="status">Carregando relatório de cultos…</p>';
  try{const data=await scope(root,db,call);if(!data)return;if(!data.can_report)throw Error('Seu perfil não tem acesso a esse relatório.');
   const date=today();root.innerHTML=`<article class="panel"><h2>Presenças no culto</h2><form class="report-filters worship-report-filters"><label>De<input type="date" name="from" value="${date.slice(0,8)}01" required></label><label>Até<input type="date" name="to" value="${date}" required></label><label>Igreja<select name="church">${options(data.churches,'Todas as igrejas permitidas')}</select></label><label>Rede<select name="network"></select></label><label>Discipulador<select name="discipler"></select></label><label>Culto<select name="service"><option value="">Todos os cultos</option>${serviceOptions}</select></label><label>Célula<select name="cell"></select></label><button class="worship-apply">Aplicar filtros</button></form><p>Os filtros respeitam as igrejas, redes e células permitidas ao seu perfil.</p></article><p class="worship-status" role="status" aria-live="polite"></p><section class="worship-totals worship-report-summary" aria-label="Resumo das presenças no culto"></section><article class="panel"><div class="worship-list-head"><h2>Presenças por pessoa</h2><div class="actions"><button class="secondary" data-export="pdf" disabled>Exportar PDF</button><button class="secondary" data-export="xlsx" disabled>Exportar planilha</button></div></div><div class="tablewrap worship-report-table"></div><p>Chamadas não realizadas e pessoas sem marcação não contam como falta.</p></article>`;
   const form=root.querySelector('form'),f=form.elements;let rows=[],notes=[];
   function update(){const oldNet=f.network.value,oldDis=f.discipler.value,oldCell=f.cell.value;
    f.network.innerHTML=options(data.networks.filter(n=>!f.church.value||n.church_id===f.church.value),'Todas as redes');if([...f.network.options].some(o=>o.value===oldNet))f.network.value=oldNet;
    const filtered=data.cells.filter(c=>(!f.church.value||c.church_id===f.church.value)&&(!f.network.value||c.network_id===f.network.value));
    f.discipler.innerHTML=options(data.disciplers.filter(d=>filtered.some(c=>c.discipler_id===d.id)),'Todos os discipuladores');if([...f.discipler.options].some(o=>o.value===oldDis))f.discipler.value=oldDis;
    f.cell.innerHTML=options(filtered.filter(c=>!f.discipler.value||c.discipler_id===f.discipler.value),'Todas as células');if([...f.cell.options].some(o=>o.value===oldCell))f.cell.value=oldCell;
   }f.church.onchange=update;f.network.onchange=update;f.discipler.onchange=update;update();
   const exportButtons=[...root.querySelectorAll('[data-export]')];
   form.onsubmit=async e=>{e.preventDefault();if(form.inert)return;form.inert=true;exportButtons.forEach(b=>b.disabled=true);message(root,'Carregando presenças…');
    try{const filters=Object.fromEntries(new FormData(form));const result=await request(call,'report',filters);if(!root.isConnected)return;rows=result.rows.map(r=>[r.full_name,window.VideiraPhone?.format(r.phone)||r.phone||'—',r.category,r.cell_name,Number(r.presences),Number(r.absences)]);
     notes=[`Período: ${filters.from.split('-').reverse().join('/')} a ${filters.to.split('-').reverse().join('/')}`,...['church','network','discipler','service','cell'].map(key=>`${({church:'Igreja',network:'Rede',discipler:'Discipulador',service:'Culto',cell:'Célula'})[key]}: ${f[key].selectedOptions[0].textContent}`)];
     root.querySelector('.worship-totals').innerHTML=reportSummary(result,rows);
     root.querySelector('.worship-report-table').innerHTML=`<table><thead><tr>${['Nome completo','Telefone','Categoria','Célula','Presenças','Faltas'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<td class="${i===4?'worship-present':i===5?'worship-absent':''}">${esc(v)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="6">Nenhuma pessoa encontrada para esses filtros.</td></tr>'}</tbody></table>`;message(root,rows.length?'Relatório atualizado.':'Nenhum resultado.');exportButtons.forEach(b=>b.disabled=!rows.length);
    }catch(error){rows=[];root.querySelector('.worship-totals').innerHTML='';root.querySelector('.worship-report-table').innerHTML='';message(root,error.message,true)}finally{form.inert=false}
   };
   root.querySelector('[data-export=xlsx]').onclick=()=>download('presencas-no-culto.xlsx',spreadsheet(rows));
   root.querySelector('[data-export=pdf]').onclick=()=>window.VideiraPersonReports.previewPdf('presencas-no-culto.pdf',{title:'Presenças no culto · Igreja Videira',notes,headers:['Nome completo','Telefone','Categoria','Célula','Presenças','Faltas'],widths:[214,120,90,170,85,85],rows});
   form.requestSubmit();
  }catch(error){root.innerHTML=`<p role="alert">${esc(error.message||'Não foi possível abrir o relatório.')}</p>`}
 }
 function mountReports(root,db,call,escape){root.innerHTML=`<div class="worship-report-tabs" role="group" aria-label="Tipo de relatório"><button class="secondary" aria-pressed="true" data-report="existing">Membros e células</button>${reportRoles.has(db.profile.role)?'<button class="secondary" aria-pressed="false" data-report="worship">Presenças no culto</button>':''}</div><div class="worship-report-content"></div>`;
  const show=kind=>{const old=root.querySelector('.worship-report-content'),content=document.createElement('div');content.className='worship-report-content';old.replaceWith(content);for(const b of root.querySelectorAll('[data-report]'))b.setAttribute('aria-pressed',String(b.dataset.report===kind));if(kind==='worship')mountReport(content,db,call);else window.VideiraPersonReports.mount(content,db,call,escape)};
  root.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>show(b.dataset.report));show('existing');
 }
 return {mountCall,mountReport,mountReports,canLeave,spreadsheet};
})();
