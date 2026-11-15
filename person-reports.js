'use strict';
window.VideiraPersonReports = (() => {
 const courses = {maturidade:'Cursão', ctl:'CTL', apocalipse:'Apocalipse', seminario:'Seminário Pastoral'};
 const headers = ['Nome', 'Igreja', 'Rede', 'Célula', 'Categoria', 'Dízimo', 'Batismo', 'Cursos registrados', 'Pendências'];
 const choices = entries => entries.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
 const answers = [['','Todos'],['true','Sim'],['false','Não'],['unknown','Não informado']];
 const select = (name,label,options) => `<label>${label}<select name="${name}">${options}</select></label>`;
 const isPending = person => person.category === 'Membro' && person.networkKind !== 'kids'
  && ['maturidade','ctl'].some(course => !person.courses.includes(course));
 const yesNo = value => value === true ? 'Sim' : value === false ? 'Não' : 'Não informado';

 function mount(root, db, call, esc) {
  const canReadCourses = ['master','discipulador','pastor','predio','obreiro','supervisor'].includes(db.profile.role);
  const byId = items => new Map(items.map(item => [item.id,item]));
  const churches = byId(db.churches), networks = byId(db.networks), cells = byId(db.cells);
  const entityOptions = (items, all) => `<option value="">${all}</option>` +
   items.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
  const courseOptions = state => choices(Object.entries(courses).map(([key,label]) => [`${state}:${key}`,label]));
  root.innerHTML = `<article class="panel"><form id="personReportFilters" class="report-filters">
    ${select('church','Igreja',entityOptions(db.churches,'Todas as igrejas'))}
    ${select('network','Rede',entityOptions(db.networks,'Todas as redes'))}
    ${select('tither','Dízimo',choices(answers))}
    ${select('course','Cursos','<option value="">Todos os cursos</option><optgroup label="Com marcação">'+courseOptions('marked')+'</optgroup><optgroup label="Sem marcação">'+courseOptions('unmarked')+'</optgroup>')}
    ${select('pending','Cadastro com pendências',choices([['','Todos'],['yes','Com pendências'],['no','Sem pendências']]))}
    ${select('category','Categoria',choices([['','Todas as categorias'],['Visitante','Visitante'],['Membro','Membro']]))}
    ${select('baptism','Batismo',choices([['','Todos'],['Sim','Sim'],['Não','Não'],['Não informado','Não informado']]))}
    <div class="actions wide"><button type="submit">Exportar em PDF</button></div>
    <small class="wide">No menu de impressão, escolha a opção para salvar como PDF. Pendências consideram Cursão e CTL de membros fora da Rede Kids.</small>
   </form><p id="personReportStatus" role="status" hidden></p></article>
   <section id="personReportPrint" class="person-report-print" aria-label="Relatório para impressão"></section>`;

  const form = root.querySelector('form');
  const feedback = root.querySelector('[role=status]');
  const printable = root.querySelector('#personReportPrint');
  const button = form.querySelector('button');
  const {church, network} = form.elements;
  form.elements.course.disabled = form.elements.pending.disabled = !canReadCourses;
  church.onchange = () => {
   const previous = network.value;
   const available = db.networks.filter(item => !church.value || item.church_id === church.value);
   network.innerHTML = entityOptions(available,'Todas as redes');
   if (available.some(item => item.id === previous)) network.value = previous;
  };

  form.onsubmit = async event => {
   event.preventDefault();
   if (button.disabled) return;
   const filter = Object.fromEntries(new FormData(form));
   const descriptions = [...form.querySelectorAll('select')].filter(control => control.value).map(control => {
    const option = control.selectedOptions[0];
    const group = option.parentElement;
    return `${control.labels[0].firstChild.textContent} · ${group.tagName === 'OPTGROUP' ? group.label + ' · ' : ''}${option.textContent}`;
   });
   button.disabled = true;
   feedback.hidden = true;
   try {
    const marks = canReadCourses ? await call('report_courses') : {};
    if (!root.isConnected) return;
    const [courseState, courseKey] = (filter.course || '').split(':');
    const rows = db.people.filter(person => person.active !== false).map(person => {
     const cell = cells.get(person.cell_id);
     const net = networks.get(cell?.network_id);
     const courseVisible = canReadCourses && (db.profile.role !== 'discipulador' || cell?.discipler_id === db.profile.id);
     return {...person, cell, courseVisible, networkKind:net?.kind, courses:marks[person.id] || []};
    }).filter(person => {
     if (!person.cell || (filter.church && filter.church !== person.cell.church_id) ||
        (filter.network && filter.network !== person.cell.network_id)) return false;
     if (filter.category && filter.category !== person.category) return false;
     if (filter.baptism && filter.baptism !== (person.baptized || 'Não informado')) return false;
     const tither = person.is_tither == null ? 'unknown' : String(person.is_tither);
     if (filter.tither && filter.tither !== tither) return false;
     if ((filter.pending || courseKey) && !person.courseVisible) return false;
     if (filter.pending && isPending(person) !== (filter.pending === 'yes')) return false;
     return !courseKey || person.courses.includes(courseKey) === (courseState === 'marked');
    });

    if (!rows.length) {
     feedback.textContent = 'Nenhum cadastro corresponde aos filtros.';
     feedback.hidden = false;
     return;
    }
    const issued = new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Maceio'}).format(new Date());
    printable.innerHTML = `<h1>Relatório de cadastros · Igreja Videira</h1>
     <p>${rows.length} cadastro(s) · ${esc(issued)}</p>
     <p>${descriptions.length ? descriptions.map(esc).join(' | ') : 'Todos os cadastros do seu escopo'}</p>
     <table><thead><tr>${headers.map(title => `<th scope="col">${title}</th>`).join('')}</tr></thead>
     <tbody>${rows.map(person => `<tr>${[
      person.full_name,churches.get(person.cell.church_id)?.name,networks.get(person.cell.network_id)?.name,
      person.cell.name,person.category,yesNo(person.is_tither),person.baptized || 'Não informado',
      person.courses.map(key => courses[key]).filter(Boolean).join(', '),person.courseVisible && isPending(person) ? 'Sim' : '—'
     ].map(value => `<td>${esc(value || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    document.body.classList.add('printing-person-report');
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-person-report'), {once:true});
    window.print();
   } catch (error) {
    feedback.textContent = error.message;
    feedback.hidden = false;
   } finally {
    button.disabled = false;
   }
  };
 }
 return {mount};
})();
