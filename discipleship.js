'use strict';
window.VideiraDiscipleship = (() => {
 const courses = {
  maturidade: 'Cursão', ctl: 'CTL',
  apocalipse: 'Apocalipse', seminario: 'Seminário Pastoral'
 };
 const requiredCourses = ['maturidade', 'ctl'];
 const situations = {
  visitante: 'Visitante', celula: 'Membro da célula', igreja: 'Membro da igreja',
  pendente: 'Membros com cursos pendentes'
 };
 const options = entries => Object.entries(entries)
  .map(([key, label]) => `<option value="${key}">${label}</option>`).join('');

 async function mount(root, call, esc, editable, data) {
  root.innerHTML='<p role="status">Carregando permissões do acompanhamento…</p>';
  try {
   const scope=await call('discipleship_scope',{});
   if(!root.isConnected)return;
   if(!scope||!Array.isArray(scope.cells)||!Array.isArray(scope.networks)||scope.editable!==true)throw Error('Permissões de acompanhamento inválidas.');
   mountScoped(root,call,esc,editable&&scope.editable,{...data,...scope,profiles:[],people:[]});
  } catch(error) {
   if(!root.isConnected)return;
   // Keep the existing screen usable while the database migration is being applied.
   if(error.status===404||error.code==='PGRST202'||/videira_discipleship_scope/.test(error.message||'')) {
    mountScoped(root,call,esc,['master','discipulador'].includes(data.profile.role),data);
    const warning=document.createElement('p');warning.className='notice';warning.textContent='A ampliação das permissões do acompanhamento ainda precisa ser ativada no servidor.';root.prepend(warning);
   } else root.innerHTML='<p role="alert">'+esc(error.message||'Não foi possível carregar o acompanhamento.')+'</p>';
  }
 }
 function mountScoped(root, call, esc, editable, {meetings, cells, networks, people, profiles, cell_leadership}) {
  const currentMonth = new Intl.DateTimeFormat('sv-SE', {
   timeZone: 'America/Maceio', year: 'numeric', month: '2-digit'
  }).format(new Date());
  const [year, monthNumber] = currentMonth.split('-').map(Number);
  const firstYear = meetings.reduce((first, meeting) => {
   const meetingYear = Number(meeting.meeting_date?.slice(0, 4));
   return meetingYear >= 1 ? Math.min(first, meetingYear) : first;
  }, year);
  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
   timeZone: 'UTC', month: 'long', year: 'numeric'
  });
  const monthOptions = [];
  for (let offset = 0; offset < (year - firstYear) * 12 + monthNumber; offset++) {
   const date = new Date(Date.UTC(year, monthNumber - 1 - offset, 1));
   const value = date.toISOString().slice(0, 7);
   const label = monthLabel.format(date);
   monthOptions.push(`<option value="${value}">${label[0].toUpperCase() + label.slice(1)}</option>`);
  }
  root.innerHTML = `<div class="panel discipleship-filters gridform">
   <label>Mês<select name="month">${monthOptions.join('')}</select></label>
   <label>Situação<select name="situation"><option value="">Todas as situações</option>${options(situations)}</select></label>
   <label>Curso<select name="course"><option value="">Todos os cursos</option>${options(courses)}</select></label>
   <label>Rede<select name="network"><option value="">Todas as redes</option></select></label>
   <label>Discipulador<select name="discipler"><option value="">Todos os discipuladores</option></select></label>
   <label>Célula<select name="cell"><option value="">Todas as células</option></select></label>
   <small class="wide">Selecione um curso para filtrar as pendências desse curso.</small>
  </div><p role="status" class="discipleship-status"></p><div class="discipleship-results"></div>
  <div class="discipleship-legend">
   <span class="legend-green">Sem faltas</span><span class="legend-orange">1 falta</span>
   <span class="legend-red">2 ou mais faltas</span><span class="course-pending">Cursos pendentes (membros)</span>
  </div>`;
  const month = root.querySelector('[name=month]');
  const situation = root.querySelector('[name=situation]');
  const course = root.querySelector('[name=course]');
  const network = root.querySelector('[name=network]');
  const cell = root.querySelector('[name=cell]');
  const discipler = root.querySelector('[name=discipler]');
  const cellsById = new Map(cells.map(item => [item.id, item]));
  const leaders = new Map([...(cell_leadership || []), ...(profiles || [])].map(item => [item.id,item]));
  const isMember = row => row.situacao === 'Membro da célula' || row.situacao === 'Membro da igreja' || row.situacao === 'Membro';
  const networkIndex = new Map(networks.map(item => [item.id, item]));
  const cellNetworks = new Map(cells.map(item => [item.id, item.network_id]));
  const kidsNetworks = new Set(networks.filter(item => item.kind === 'kids').map(item => item.id));
  const exempt = row => isMember(row) && kidsNetworks.has(cellNetworks.get(row.celulaId));
  const feedback = root.querySelector('[role=status]');
  const results = root.querySelector('.discipleship-results');
  const keys = Object.keys(courses);
  const pending = row => isMember(row) && !exempt(row) && requiredCourses.some(key => !row.cursos.includes(key));
  let rows = [], loading = false, saving = false;

  function setChoices(control, choices) {
   const previous = control.value;
   control.length = 1;
   for (const [id, title] of choices) control.add(new Option(title, id));
   control.value = choices.has(previous) ? previous : '';
  }

  function matchesNetwork(row) {
   const id = cellNetworks.get(row.celulaId);
   return window.VideiraNetworkFilters.matches(network.value, networkIndex.get(id), id);
  }

  function updateCells() {
   const available = rows.filter(row => matchesNetwork(row) && (!discipler.value || cellsById.get(row.celulaId)?.discipler_id === discipler.value));
   setChoices(cell, new Map(available.map(row => [row.celulaId, row.celula])));
  }

  function matchesFilters(row) {
   if (!matchesNetwork(row)) return false;
   if (discipler.value && cellsById.get(row.celulaId)?.discipler_id !== discipler.value) return false;
   if (cell.value && row.celulaId !== cell.value) return false;
   const filter = situation.value;
   if (filter === 'pendente' ? !pending(row) : filter && row.situacao !== situations[filter]) return false;
   return !course.value || (!exempt(row) && !row.cursos.includes(course.value));
  }

  function situationMarkup(row) {
   return esc(row.situacao) + (pending(row) ? '<span class="course-pending">Cursos pendentes</span>' : '');
  }

  const peopleById = new Map(people.map(person => [person.id, person]));
  const personFields = {encounter_with_god:'Encontro com Deus', baptized:'Batismo', is_tither:'Dizimista'};
  const personChecked = (person, key) => key === 'baptized'
   ? person.baptized === 'Sim' : person[key] === true;
  function personField(row, key, label) {
   const person = Object.hasOwn(row, key) ? row : peopleById.get(row.id);
   if (!person) return '—';
   return `<input type="checkbox" data-person-field="${key}" data-person="${esc(row.id)}"
    aria-label="${esc(label + ' · ' + row.nome)}" ${personChecked(person, key) ? 'checked' : ''}
    ${editable ? '' : 'disabled'}>`;
  }

  function render() {
   if (loading || saving) return;
   const groups = new Map();
   for (const row of rows.filter(matchesFilters)) {
    if (!groups.has(row.celulaId)) groups.set(row.celulaId, []);
    groups.get(row.celulaId).push(row);
   }
   results.innerHTML = [...groups.values()].map(group => `<article class="panel">
    <h2>${esc(group[0].celula)}</h2>${cellsById.get(group[0].celulaId)?.is_paused?'<span class="cell-paused-tag">Não está funcionando</span>':''}
    <div class="table-scroll"><table class="discipleship-table" aria-label="${esc(group[0].celula)}">
     <thead><tr>${['Nome','Situação','Telefone','Líder','Presença','Falta',personFields.encounter_with_god,personFields.baptized,...Object.values(courses),personFields.is_tither]
      .map(title => `<th scope="col">${title}</th>`).join('')}</tr></thead>
     <tbody>${group.map(row => `<tr class="${row.faltas >= 2 ? 'absent-many' : row.faltas ? 'absent-one' : row.presencas ? 'absent-none' : ''}">
      <th scope="row">${esc(row.nome)}</th>
      <td data-situation>${situationMarkup(row)}</td>
      <td>${esc(window.VideiraPhone.format(row.telefone) || '—')}</td><td>${esc(row.lider || '—')}</td>
      <td>${row.presencas}</td><td>${row.faltas}</td>
      ${['encounter_with_god','baptized'].map(key=>`<td>${personField(row,key,personFields[key])}</td>`).join('')}
      ${keys.map(key => `<td><input type="checkbox" data-person="${esc(row.id)}" data-course="${key}"
        aria-label="${esc(courses[key] + ' · ' + row.nome)}" ${row.cursos.includes(key) ? 'checked' : ''} ${editable ? '' : 'disabled'}></td>`).join('')}
      <td>${personField(row,'is_tither',personFields.is_tither)}</td>
     </tr>`).join('')}</tbody>
    </table></div></article>`).join('') || '<p class="empty">Nenhum cadastro corresponde aos filtros.</p>';
  }

  async function load() {
   if (!/^\d{4}-\d{2}$/.test(month.value)) return;
   loading = true;
   month.disabled = true;
   feedback.textContent = 'Carregando acompanhamento…';
   results.replaceChildren();
   try {
    rows = await call('discipleship', {p_month: month.value + '-01'});
    const churches = new Set(networks.map(item => item.church_id));
    window.VideiraNetworkFilters.update(network, networks, churches.size === 1 ? networks[0].church_id : '');
    setChoices(discipler,new Map(cells.filter(item=>leaders.has(item.discipler_id)).map(item=>{const person=leaders.get(item.discipler_id);return [person.id,person.display_name || person.card_name || person.username]})));
    updateCells();
    feedback.textContent = '';
   } catch (error) {
    rows = [];
    feedback.textContent = error.message;
    return;
   } finally {
    loading = false;
    month.disabled = false;
   }
   render();
  }
  month.onchange = load;
  situation.onchange = course.onchange = cell.onchange = render;
  network.onchange = () => { updateCells(); render(); };
  discipler.onchange = () => { updateCells(); render(); };
  results.onchange = async event => {
   const control = event.target;
   if (editable && !saving && control.matches('[data-person-field]')) {
    saving = true;
    const fieldLocks=[month,situation,course,network,discipler,cell,...results.querySelectorAll('input')];
    fieldLocks.forEach(input=>{input.disabled=true});
    const {person: id, personField: key} = control.dataset;
    const row = rows.find(row => row.id === id);
    const person = peopleById.get(id);
    const value = control.checked ? 'Sim' : 'Não';
    control.disabled = true;
    try {
     await call('discipleship_person_field',{p_person:id,p_field:key,p_value:value});
     const updatedValue = key === 'baptized' ? value : value === 'Sim';
     if (row) row[key] = updatedValue;
     if (person) person[key] = updatedValue;
     if (key === 'encounter_with_god' && row) {
      row.situacao = control.checked ? 'Membro da igreja' : 'Membro da célula';
      control.closest('tr').querySelector('[data-situation]').innerHTML = situationMarkup(row);
     }
     feedback.textContent = '';
    } catch (error) {
     control.checked = personChecked(Object.hasOwn(row ?? {}, key) ? row : person ?? {}, key);
     feedback.textContent = error.message;
    } finally {
     saving = false;
     fieldLocks.forEach(input=>{input.disabled=false});
     render();
    }
    return;
   }
   const checkbox = control;
   if (!editable || saving || !checkbox.matches('[data-person][data-course]')) return;
   saving = true;
   const {person, course: courseKey} = checkbox.dataset;
   const focused = document.activeElement === checkbox;
   const monthDate = month.value + '-01';
   const selectors = [month, situation, course, network, discipler, cell];
   const inputs = [...results.querySelectorAll('[data-course]')];
   const locks = [...selectors, ...inputs];
   locks.forEach(control => { control.disabled = true; });
   let saved = false;
   try {
    await call('discipleship', {
     p_month: monthDate, p_person: person, p_course: courseKey, p_marked: checkbox.checked
    });
    saved = true;
    const updatedRows = await call('discipleship', {p_month: monthDate});
    if (!root.isConnected) return;

    const updated = updatedRows.find(row => row.id === person);
    rows = updatedRows;
    const line = checkbox.closest('tr');
    if (updated && matchesFilters(updated)) {
     line.querySelector('[data-situation]').innerHTML = situationMarkup(updated);
     for (const input of line.querySelectorAll('[data-course]')) {
      input.checked = updated.cursos.includes(input.dataset.course);
     }
    } else {
     const block = line.closest('article');
     line.remove();
     if (!block.querySelector('tbody tr')) block.remove();
     if (!results.childElementCount) {
      results.innerHTML = '<p class="empty">Nenhum cadastro corresponde aos filtros.</p>';
     }
    }
    feedback.textContent = '';
   } catch (error) {
    if (!saved) checkbox.checked = !checkbox.checked;
    feedback.textContent = saved
     ? 'Curso salvo. Troque o mês ou recarregue para atualizar a situação.'
     : error.message;
   } finally {
    saving = false;
    locks.forEach(control => { control.disabled = false; });
    if (focused && checkbox.isConnected && document.activeElement === document.body) {
     checkbox.focus({preventScroll: true});
    }
   }
  };
  load();
 }
 return {mount};
})();
