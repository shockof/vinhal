'use strict';
window.VideiraDiscipleship = (() => {
 const courses = {
  maturidade: 'Maturidade no Espírito', ctl: 'CTL',
  apocalipse: 'Curso de Apocalipse', seminario: 'Seminário Pastoral'
 };
 const situations = {
  visitante: 'Visitante', assiduo: 'Frequentador assíduo', membro: 'Membro',
  pendente: 'Membros com cursos pendentes'
 };
 const options = entries => Object.entries(entries)
  .map(([key, label]) => `<option value="${key}">${label}</option>`).join('');

 function mount(root, call, esc, editable) {
  const currentMonth = new Intl.DateTimeFormat('sv-SE', {
   timeZone: 'America/Maceio', year: 'numeric', month: '2-digit'
  }).format(new Date());
  root.innerHTML = `<div class="panel discipleship-filters gridform">
   <label>Mês<input type="month" value="${currentMonth}" required></label>
   <label>Situação<select name="situation"><option value="">Todas as situações</option>${options(situations)}</select></label>
   <label>Curso<select name="course"><option value="">Todos os cursos</option>${options(courses)}</select></label>
   <small class="wide">Selecione um curso para filtrar as pendências desse curso.</small>
  </div><p role="status" class="discipleship-status"></p><div class="discipleship-results"></div>
  <div class="discipleship-legend">
   <span class="legend-green">Sem faltas</span><span class="legend-orange">1 falta</span>
   <span class="legend-red">2 ou mais faltas</span><span class="course-pending">Cursos pendentes (membros)</span>
  </div>`;
  const month = root.querySelector('input');
  const situation = root.querySelector('[name=situation]');
  const course = root.querySelector('[name=course]');
  const feedback = root.querySelector('[role=status]');
  const results = root.querySelector('.discipleship-results');
  const keys = Object.keys(courses);
  const pending = row => row.situacao === 'Membro' && keys.some(key => !row.cursos.includes(key));
  let rows = [], loading = false, saving = false;

  function render() {
   if (loading || saving) return;
   const groups = new Map();
   for (const row of rows) {
    const filter = situation.value;
    if (filter === 'pendente' ? !pending(row) : filter && row.situacao !== situations[filter]) continue;
    if (course.value && row.cursos.includes(course.value)) continue;
    if (!groups.has(row.celulaId)) groups.set(row.celulaId, []);
    groups.get(row.celulaId).push(row);
   }
   results.innerHTML = [...groups.values()].map(group => `<article class="panel">
    <h2>${esc(group[0].celula)}</h2>
    <div class="table-scroll"><table aria-label="${esc(group[0].celula)}">
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
  situation.onchange = course.onchange = render;
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
