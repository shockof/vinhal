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

 // PDF offsets count bytes. Text is encoded as hexadecimal WinAnsi, so the file stays ASCII.
 function pdfText(value) {
  const extended = {'–':150, '—':151, '‘':145, '’':146, '“':147, '”':148, '…':133, '€':128};
  const bytes = Array.from(value.normalize('NFC'), char => {
   const code = char.codePointAt(0);
   return (code >= 32 && code < 127 || code >= 160 && code <= 255 ? code : extended[char] ?? 63)
    .toString(16).padStart(2, '0');
  });
  return '<' + bytes.join('') + '>';
 }

 function wrapText(value, width, size) {
  const limit = Math.floor(width / (size * 0.6));
  const lines = [];
  let line = '';
  for (const word of String(value ?? '—').trim().split(/\s+/)) {
   const letters = Array.from(word);
   if (line && Array.from(line).length + 1 + letters.length > limit) {
    lines.push(line);
    line = '';
   }
   while (letters.length > limit) lines.push(letters.splice(0, limit).join(''));
   if (letters.length) line = line ? line + ' ' + letters.join('') : letters.join('');
  }
  return [...lines, line];
 }

 function makePdf({title, notes, headers, widths, rows, sections = [{rows}]}, previewPages = []) {
  const width = 841.89, height = 595.28, margin = 30;
  const tableWidth = widths.reduce((sum, column) => sum + column, 0);
  const size = 8.5, leading = 11, padding = 5;
  const objects = ['', '',
   '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
   '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>'];
  const pages = [];
  const headings = headers.map((label, index) => wrapText(label, widths[index] - 2 * padding, size));
  let commands, y, svg;
  const xml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));

  function write(value, x, baseline, fontSize, font = 'F1', color = '0.16 0.13 0.22') {
   commands.push(`BT /${font} ${fontSize} Tf ${color} rg 1 0 0 1 ${x} ${baseline} Tm ${pdfText(value)} Tj ET`);
   svg.push(`<text x="${x}" y="${height-baseline}" font-size="${fontSize}" font-weight="${font==='F2'?'bold':'normal'}" fill="rgb(${color.split(' ').map(n=>Math.round(Number(n)*255)).join(',')})">${xml(value)}</text>`);
  }

  function drawRow(columns, lineCount, heading = false) {
   const rowHeight = lineCount * leading + 2 * padding;
   if (heading) commands.push(`0.92 0.88 0.97 rg ${margin} ${y - rowHeight} ${tableWidth} ${rowHeight} re f`);
   if (heading) svg.push(`<rect x="${margin}" y="${height-y}" width="${tableWidth}" height="${rowHeight}" fill="#ebe0f7"/>`);
   let x = margin;
   columns.forEach((lines, index) => {
    lines.forEach((line, number) => write(line, x + padding, y - padding - size - number * leading, size, heading ? 'F2' : 'F1'));
    x += widths[index];
   });
   y -= rowHeight;
   commands.push(`0.87 0.84 0.91 RG 0.5 w ${margin} ${y} m ${margin + tableWidth} ${y} l S`);
   svg.push(`<path d="M${margin} ${height-y} H${margin+tableWidth}" stroke="#ded6e8" stroke-width=".5"/>`);
  }

  function beginPage(section) {
   commands = [];
   svg = [];
   y = height - margin;
   write(title, margin, y - 17, 17, 'F2', '0.29 0.16 0.49');
   y -= 34;
   for (const note of notes) {
    for (const line of wrapText(note, tableWidth, 9)) {
     write(line, margin, y, 9);
     y -= 12;
    }
   }
   y -= 8;
   if (section.title) {
    for (const line of wrapText(section.title, tableWidth, 13)) {
     write(line, margin, y, 13, 'F2', '0.29 0.16 0.49');
     y -= 17;
    }
    for (const detail of section.details) {
     for (const line of wrapText(detail, tableWidth, 9)) {
      write(line, margin, y, 9);
      y -= 12;
     }
    }
    y -= 6;
   }
   drawRow(headings, Math.max(...headings.map(lines => lines.length)), true);
  }

  function finishPage() {
   write(`Página ${pages.length + 1}`, margin, 18, 8);
   previewPages.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Página ${pages.length+1} do relatório" font-family="Courier, monospace"><rect width="${width}" height="${height}" fill="white"/>${svg.join('')}</svg>`);
   const stream = commands.join('\n') + '\n';
   const contents = objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
   pages.push(objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}]
    /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contents} 0 R >>`));
  }

  const availableLines = () => Math.floor((y - margin - 2 * padding) / leading);
  for (const section of sections) {
   beginPage(section);
   const fullPageLines = availableLines();
   for (const row of section.rows) {
    const columns = row.map((value, index) => wrapText(value, widths[index] - 2 * padding, size));
    const total = Math.max(...columns.map(lines => lines.length));
    for (let start = 0; start < total;) {
     if (Math.min(total - start, fullPageLines) > availableLines()) {
      finishPage();
      beginPage(section);
     }
     const count = Math.min(total - start, availableLines());
     drawRow(columns.map(lines => lines.slice(start, start + count)), count);
     start += count;
    }
   }
   finishPage();
  }

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(page => page + ' 0 R').join(' ')}] >>`;
  const parts = ['%PDF-1.4\n'];
  const offsets = ['0000000000 65535 f \n'];
  let offset = parts[0].length;
  objects.forEach((object, index) => {
   const entry = `${index + 1} 0 obj\n${object}\nendobj\n`;
   offsets.push(String(offset).padStart(10, '0') + ' 00000 n \n');
   parts.push(entry);
   offset += entry.length;
  });
  parts.push(`xref\n0 ${offsets.length}\n${offsets.join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`);
  return parts;
 }

 function previewPdf(filename, report) {
  document.querySelector('dialog.report-preview')?.close();
  const previewPages = [];
  const url = URL.createObjectURL(new Blob(makePdf(report,previewPages), {type:'application/pdf'}));
  const dialog = document.createElement('dialog');
  dialog.className = 'report-preview';
  dialog.setAttribute('aria-labelledby','reportPreviewTitle');
  dialog.innerHTML = `<div class="report-preview-heading"><div><h2 id="reportPreviewTitle"></h2><p>Confira o relatório antes de baixar. PDF em formato horizontal.</p></div>
   <div class="actions"><a class="report-preview-download" download>Baixar PDF</a><button type="button" class="secondary">Fechar</button></div></div>
   <div class="report-preview-pages"><div class="report-preview-document"></div></div>`;
  dialog.querySelector('h2').textContent = report.title;
  const link = dialog.querySelector('a');
  link.href = url;
  link.download = filename;
  dialog.querySelector('.report-preview-document').innerHTML = previewPages.join('');
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
   dialog.remove();
   setTimeout(() => URL.revokeObjectURL(url),60000);
  },{once:true});
  document.body.append(dialog);
  dialog.showModal();
 }

 function groupedCellSections(db, selected, marks, canReadCourses, networks, from, to) {
  const meetings = new Map(db.meetings.filter(item => !item.deleted_at).map(item => [item.id, item]));
  const profiles = new Map([...(db.cell_leadership || []), ...db.profiles].map(item => [item.id, item.card_name || item.username || item.display_name]));
  const people = new Map(db.people.map(item => [item.id, item]));
  const groups = new Map(selected.map(cell => [cell.id, []]));
  const counts = new Map();
  for (const person of db.people) {
   if (person.active === false || !groups.has(person.cell_id)) continue;
   groups.get(person.cell_id).push(person);
   counts.set(person.id, {present:0, absent:0, lifetimePresent:0});
  }
  for (const record of db.attendance) {
   const count = counts.get(record.person_id);
   const meeting = meetings.get(record.meeting_id);
   if (!count || !meeting) continue;
   if (record.present === true) count.lifetimePresent++;
   if (meeting.cell_id !== people.get(record.person_id).cell_id ||
       (from && meeting.meeting_date < from) || (to && meeting.meeting_date > to)) continue;
   if (record.present === true) count.present++;
   if (record.present === false) count.absent++;
  }
  return selected.map(cell => {
   const address = cell.address_details || {};
   const street = [address.street, address.house_number].filter(Boolean).join(', ');
   const location = [street || cell.private_address, address.postal_code && `CEP ${address.postal_code}`].filter(Boolean).join(' · ');
   const courseVisible = canReadCourses && (db.profile.role !== 'discipulador' || cell.discipler_id === db.profile.id);
   const networkKind = networks.get(cell.network_id)?.kind;
   const rows = groups.get(cell.id).map(person => {
    const {present, absent, lifetimePresent} = counts.get(person.id);
    const personCourses = marks[person.id] || [];
    let status = person.membership_status || (person.encounter_with_god ? 'Membro da igreja' : person.category === 'Membro' ? 'Membro da célula' : 'Visitante');
    
    if (courseVisible && isPending({...person, networkKind, courses:personCourses})) status += ' · Cursos pendentes';
    return [person.full_name, status, window.VideiraPhone?.format(person.phone) || person.phone || '—', present, absent, yesNo(person.encounter_with_god), person.baptized || 'Não informado',
     ...Object.keys(courses).map(key => courseVisible ? yesNo(personCourses.includes(key)) : '—'),
     yesNo(person.is_tither)];
   });
   return {
    title:cell.name,
    details:[
     `Líder: ${profiles.get(cell.leader_id) || 'Não informado'}`,
     `Líder em treinamento: ${people.get(db.cell_trainees?.[cell.id])?.full_name || 'Não informado'}`,
     `Dia e horário: ${cell.meeting_schedule || 'Não informado'}`,
     `Endereço: ${location || 'Não informado'}`
    ],
    rows:rows.length ? rows : [['Nenhuma pessoa cadastrada', ...Array(11).fill('—')]]
   };
  });
 }

 function mount(root, db, call, esc) {
  const canReadCourses = ['master','discipulador','pastor','predio','obreiro','supervisor'].includes(db.profile.role);
  const byId = items => new Map(items.map(item => [item.id,item]));
  const churches = byId(db.churches), networks = byId(db.networks), cells = byId(db.cells);
  const entityOptions = (items, all) => `<option value="">${all}</option>` +
   items.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
  const courseOptions = state => choices(Object.entries(courses).map(([key,label]) => [`${state}:${key}`,label]));
  const cellStatuses = [['','Todas as situações'],['active','Está acontecendo'],['paused','Não está acontecendo']];
  const cellFilterMarkup = `<article class="panel"><h2>Relatórios de células</h2>
   <form id="cellReportFilters" class="report-filters">
    ${select('church','Igreja',entityOptions(db.churches,'Todas as igrejas'))}
    ${select('network','Rede',entityOptions(db.networks,'Todas as redes'))}
    ${select('cell','Célula',entityOptions(db.cells,'Todas as células'))}
    ${select('status','Situação',choices(cellStatuses))}
    <label>Data inicial<input type="date" name="from"></label>
    <label>Data final<input type="date" name="to"></label>
    ${select('format','Tipo de relatório',choices([['simplified','Simplificado'],['grouped','Blocado']]))}
    <div class="actions wide"><button type="submit">Visualizar relatório de células em PDF</button></div>
   </form><p id="cellReportStatus" role="status" hidden></p></article>`;
  root.innerHTML = `<article class="panel"><h2>Relatório Geral</h2><form id="personReportFilters" class="report-filters">
    ${select('church','Igreja',entityOptions(db.churches,'Todas as igrejas'))}
    ${select('network','Rede',entityOptions(db.networks,'Todas as redes'))}
    ${select('tither','Dízimo',choices(answers))}
    ${select('course','Cursos','<option value="">Todos os cursos</option><optgroup label="Com marcação">'+courseOptions('marked')+'</optgroup><optgroup label="Sem marcação">'+courseOptions('unmarked')+'</optgroup>')}
    ${select('pending','Cadastro com pendências',choices([['','Todos'],['yes','Com pendências'],['no','Sem pendências']]))}
    ${select('category','Categoria',choices([['','Todas as categorias'],['Visitante','Visitante'],['Membro da célula','Membro da célula'],['Membro da igreja','Membro da igreja']]))}
    ${select('baptism','Batismo',choices([['','Todos'],['Sim','Sim'],['Não','Não'],['Não informado','Não informado']]))}
    <div class="actions wide"><button type="submit">Visualizar PDF</button></div>
    <small class="wide">Pendências consideram Cursão e CTL de membros fora da Rede Kids.</small>
   </form><p id="personReportStatus" role="status" hidden></p></article>
   ${cellFilterMarkup}`;

  const form = root.querySelector('#personReportFilters');
  const feedback = root.querySelector('#personReportStatus');
  const button = form.querySelector('button');
  const {church, network} = form.elements;
  form.elements.course.disabled = form.elements.pending.disabled = !canReadCourses;
  const networkFilters = window.VideiraNetworkFilters;
  const updateReportNetworks = (control, churchId) =>
   networkFilters.update(control, db.networks, churchId, 'Todas as redes', {includeAdultsAndYouth:true});
  const updateNetworks = () => updateReportNetworks(network, church.value);
  church.onchange = updateNetworks;
  updateNetworks();

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
        !networkFilters.matches(filter.network, networks.get(person.cell.network_id), person.cell.network_id)) return false;
     if (filter.category && filter.category !== person.membership_status) return false;
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
    previewPdf('relatorio-cadastros-videira.pdf', {
     title:'Relatório de cadastros · Igreja Videira',
     notes:[`${rows.length} cadastro(s) · ${issued}`, descriptions.join(' | ') || 'Todos os cadastros do seu escopo'],
     headers,
     widths:[118,92,88,108,76,57,62,116,63],
     rows:rows.map(person => [
      person.full_name,churches.get(person.cell.church_id)?.name,networks.get(person.cell.network_id)?.name,
      person.cell.name,person.membership_status || person.category,yesNo(person.is_tither),person.baptized || 'Não informado',
      person.courses.map(key => courses[key]).filter(Boolean).join(', ') || '—',person.courseVisible && isPending(person) ? 'Sim' : '—'
     ])
    });
   } catch (error) {
    feedback.textContent = error.message;
    feedback.hidden = false;
   } finally {
    button.disabled = false;
   }
  };
  const cellForm = root.querySelector('#cellReportFilters');
  const cellFeedback = root.querySelector('#cellReportStatus');
  const filters = cellForm.elements;
  const cellMatchesScope = cell => (!filters.church.value || cell.church_id === filters.church.value)
   && networkFilters.matches(filters.network.value, networks.get(cell.network_id), cell.network_id);
  function updateOptions(control, items, all) {
   const previous = control.value;
   control.innerHTML = entityOptions(items, all);
   if (items.some(item => item.id === previous)) control.value = previous;
  }
  function updateCellOptions() {
   updateOptions(filters.cell, db.cells.filter(cellMatchesScope), 'Todas as células');
  }
  filters.church.onchange = () => {
   updateReportNetworks(filters.network, filters.church.value);
   updateCellOptions();
  };
  filters.network.onchange = updateCellOptions;
  filters.church.onchange();
  cellForm.addEventListener('change', () => { cellFeedback.hidden = true; });
  const cellButton = cellForm.querySelector('button');
  cellForm.onsubmit = async event => {
   event.preventDefault();
   if (cellButton.disabled) return;
   const {cell, status, from, to, format} = Object.fromEntries(new FormData(cellForm));
   const selected = db.cells.filter(item => cellMatchesScope(item) && (!cell || item.id === cell)
    && (!status || Boolean(item.is_paused) === (status === 'paused')));
   const problem = from && to && from > to ? 'A data final deve ser igual ou posterior à data inicial.'
    : selected.length ? '' : 'Nenhuma célula corresponde aos filtros.';
   cellFeedback.textContent = problem;
   cellFeedback.hidden = !problem;
   if (problem) return;
   const dateLabel = value => value.split('-').reverse().join('/');
   const period = [from && `desde ${dateLabel(from)}`, to && `até ${dateLabel(to)}`].filter(Boolean).join(' ');
   const notes = [`${selected.length} célula(s) · ${period || 'Todo o histórico de encontros'}`];
   if (format === 'grouped') {
    cellButton.disabled = true;
    try {
     const marks = canReadCourses ? await call('report_courses') : {};
     if (!cellForm.isConnected) return;
     previewPdf('relatorio-celulas-blocado-videira.pdf', {
      title:'Relatório de células · Modelo blocado',
      notes,
      headers:['Nome','Situação','Telefone','Presença','Falta','Encontro com Deus','Batismo','Cursão','CTL','Apocalipse','Seminário Pastoral','Dizimista'],
      widths:[128,107,77,45,36,57,48,46,30,59,87,58],
      sections:groupedCellSections(db, selected, marks, canReadCourses, networks, from, to)
     });
    } catch (error) {
     cellFeedback.textContent = error.message || 'Não foi possível exportar o relatório.';
     cellFeedback.hidden = false;
    } finally {
     cellButton.disabled = false;
    }
    return;
   }

   const totals = new Map(selected.map(item => [item.id, {members:0, visitors:0, meetings:0, present:0, absent:0}]));
   for (const person of db.people) {
    const count = totals.get(person.cell_id);
    if (!count || person.active === false) continue;
    if (person.category === 'Membro') count.members++;
    if (person.category === 'Visitante') count.visitors++;
   }
   const meetingTotals = new Map();
   for (const meeting of db.meetings) {
    const count = totals.get(meeting.cell_id);
    if (!count || meeting.deleted_at || (from && meeting.meeting_date < from) || (to && meeting.meeting_date > to)) continue;
    count.meetings++;
    meetingTotals.set(meeting.id, count);
   }
   for (const attendance of db.attendance) {
    const count = meetingTotals.get(attendance.meeting_id);
    if (!count) continue;
    if (attendance.present === true) count.present++;
    if (attendance.present === false) count.absent++;
   }
   const headings = ['Célula','Igreja','Rede','Situação','Membros atuais','Visitantes atuais','Encontros','Presenças','Faltas','Frequência'];
   previewPdf('relatorio-celulas-videira.pdf', {
    title:'Relatório de células · Igreja Videira',
    notes,
    headers:headings,
    widths:[126,104,100,106,66,72,54,54,42,56],
    rows:selected.map(item => {
     const {members, visitors, meetings, present, absent} = totals.get(item.id);
     const frequency = present + absent ? `${Math.round(100 * present / (present + absent))}%` : '—';
     return [item.name,churches.get(item.church_id)?.name,networks.get(item.network_id)?.name,
      cellStatuses[item.is_paused ? 2 : 1][1],members,visitors,meetings,present,absent,frequency];
    })
   });
  };

 }
 return {mount};
})();
