'use strict';
window.VideiraDiscipleship = (() => {
 const courses = {
  maturidade: 'Cursão', ctl: 'CTL',
  apocalipse: 'Curso de Apocalipse', seminario: 'Seminário Pastoral'
 };
 const requiredCourses = ['maturidade', 'ctl'];
 const situations = {
  visitante: 'Visitante', assiduo: 'Frequentador assíduo', membro: 'Membro',
  pendente: 'Membros com cursos pendentes'
 };
 const options = entries => Object.entries(entries)
  .map(([key, label]) => `<option value="${key}">${label}</option>`).join('');

 function mount(root, call, esc, editable, {meetings, cells, networks}) {
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
  const cellNetworks = new Map(cells.map(item => [item.id, item.network_id]));
  const kidsNetworks = new Set(networks.filter(item => item.kind === 'kids').map(item => item.id));
  const exempt = row => row.situacao === 'Membro' && kidsNetworks.has(cellNetworks.get(row.celulaId));
  const feedback = root.querySelector('[role=status]');
  const results = root.querySelector('.discipleship-results');
  const keys = Object.keys(courses);
  const pending = row => row.situacao === 'Membro' && !exempt(row) && requiredCourses.some(key => !row.cursos.includes(key));
  let rows = [], loading = false, saving = false;

  function setChoices(control, choices) {
   const previous = control.value;
   control.length = 1;
   for (const [id, title] of choices) control.add(new Option(title, id));
   control.value = choices.has(previous) ? previous : '';
  }

  function updateCells() {
   const available = rows.filter(row => !network.value || cellNetworks.get(row.celulaId) === network.value);
   setChoices(cell, new Map(available.map(row => [row.celulaId, row.celula])));
  }

  function render() {
   if (loading || saving) return;
   const groups = new Map();
   for (const row of rows) {
    if (network.value && cellNetworks.get(row.celulaId) !== network.value) continue;
    if (cell.value && row.celulaId !== cell.value) continue;
    const filter = situation.value;
    if (filter === 'pendente' ? !pending(row) : filter && row.situacao !== situations[filter]) continue;
    if (course.value && (exempt(row) || row.cursos.includes(course.value))) continue;
    if (!groups.has(row.celulaId)) groups.set(row.celulaId, []);
    groups.get(row.celulaId).push(row);
   }
   results.innerHTML = [...groups.values()].map(group => `<article class="panel">
    <h2>${esc(group[0].celula)}</h2>
    <div class="table-scroll"><table class="discipleship-table" aria-label="${esc(group[0].celula)}">
     <thead><tr>${['Nome','Situação','Telefone','Célula','Líder','Presenças','Faltas',...Object.values(courses)]
      .map(title => `<th scope="col">${title}</th>`).join('')}</tr></thead>
     <tbody>${group.map(row => `<tr class="${row.faltas >= 2 ? 'absent-many' : row.faltas ? 'absent-one' : row.presencas ? 'absent-none' : ''}">
      <th scope="row">${esc(row.nome)}</th>
      <td>${esc(row.situacao)}${pending(row) ? '<span class="course-pending">Cursos pendentes</span>' : ''}</td>
      <td>${esc(row.telefone || '—')}</td><td>${esc(row.celula)}</td><td>${esc(row.lider || '—')}</td>
      <td>${row.presencas}</td><td>${row.faltas}</td>
      ${keys.map(key => `<td><input type="checkbox" data-person="${esc(row.id)}" data-course="${key}"
        aria-label="${esc(courses[key] + ' · ' + row.nome)}" ${row.cursos.includes(key) ? 'checked' : ''} ${editable ? '' : 'disabled'}></td>`).join('')}
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
    const networkIds = new Set(rows.map(row => cellNetworks.get(row.celulaId)));
    setChoices(network, new Map(networks.filter(item => networkIds.has(item.id)).map(item => [item.id, item.name])));
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
  results.onchange = async event => {
   const checkbox = event.target;
   if (!editable || saving || !checkbox.matches('[data-person][data-course]')) return;
   saving = true;
   month.disabled = true;
   const inputs = [...results.querySelectorAll('input')];
   inputs.forEach(input => { input.disabled = true; });
   try {
    await call('discipleship', {
     p_month: month.value + '-01', p_person: checkbox.dataset.person,
     p_course: checkbox.dataset.course, p_marked: checkbox.checked
    });
    saving = false;
    await load();
   } catch (error) {
    checkbox.checked = !checkbox.checked;
    feedback.textContent = error.message;
   } finally {
    saving = false;
    month.disabled = false;
    inputs.forEach(input => { input.disabled = false; });
   }
  };
  load();
 }
 return {mount};
})();
