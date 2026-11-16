'use strict';

let displayedRegistration;
let registrationRefreshTimer;

let editedRegistrationId = '';
let openRegistrationId = '';
let registrationListVersion = 0;

const REGISTRATION_FORMATS = {
  conference: ['Conferência e Capacitação', 300],
  front: ['Encontro com Deus', 96],
  couples: ['Encontro de Casais', 60],
  workshop: ['Workshop de Louvor', 40]
};
const MAX_REGISTRATION_CAPACITY = 1000;
function registrationCapacity(event) {
  return Number.isInteger(event.capacity) && event.capacity > 0 && event.capacity <= MAX_REGISTRATION_CAPACITY ? event.capacity : 300;
}

function registrationEvents(content) {
  if (Array.isArray(content.registrationEvents)) return content.registrationEvents;
  return content.registrations?.id ? [content.registrations] : [];
}

function registrationEditor() {
  const events = registrationEvents(cmsWorking);
  const event = events.find(item => item.id === editedRegistrationId) || events[0];
  editedRegistrationId = event?.id || '';
  return `<h2>Inscrições</h2>
    <p>Crie e edite eventos. Salve o rascunho e publique para atualizar a página. Desativar um evento preserva suas inscrições.</p>
    <div class="toolbar">
      ${event ? `<label>Evento para editar<select id="cms-registration-select">
        ${events.map(item => `<option value="${esc(item.id)}" ${item.id === event.id ? 'selected' : ''}>${esc(item.title || 'Novo evento')} · ${item.enabled ? 'Ativado' : 'Desativado'}</option>`).join('')}
      </select></label>` : ''}
      <button type="button" class="dash-button" id="cms-registration-new">Adicionar evento</button>
    </div>
    ${event ? `<div class="cms-form-grid" id="cms-registration-fields">
      <label>Inscrições<select name="enabled">
        <option value="closed">Desativadas</option>
        <option value="open" ${event.enabled === true ? 'selected' : ''}>Ativadas</option>
      </select></label>
      ${cmsField('Nome do evento','title',event.title || '')}
      <label>Formato do mapa<select name="layout">${Object.entries(REGISTRATION_FORMATS).map(([id,[label]]) => `<option value="${id}" ${(event.layout || 'conference') === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Total de vagas<input type="number" name="capacity" min="1" max="${MAX_REGISTRATION_CAPACITY}" step="1" required value="${registrationCapacity(event)}"></label>
      <div class="cms-wide registration-map" data-registration-editor-map></div>
      ${cmsField('Data e horário','schedule',event.schedule || '')}
      ${cmsField('Local','venue',event.venue || '')}
      ${cmsArea('Informações do evento','description',event.description || '',1000)}
      <label>Imagem de capa<input type="file" name="coverFile" accept="image/png,image/jpeg,image/webp"><small>JPG, PNG ou WebP · até 5 MB</small></label>
      ${event.cover ? `<div><img class="registration-editor-cover" src="${esc(cmsImage(event.cover))}" alt="Capa do evento"><button class="dash-button" type="button" id="cms-registration-remove-cover">Retirar capa</button></div>` : ''}
      <p role="status" class="cms-wide"></p>
    </div>` : ''}`;
}

function bindRegistrationEditor() {
  const add = document.getElementById('cms-registration-new');
  if (!add) return;
  const events = registrationEvents(cmsWorking);
  add.onclick = () => {
    if (editor && !validateCapacity()) return;
    const event = {layout:'conference', capacity:300, id:crypto.randomUUID(), enabled:false, title:'', description:'', schedule:'', venue:'', cover:''};
    cmsWorking.registrationEvents = [...events, event];
    editedRegistrationId = event.id;
    cmsMarkDirty();
    cmsRender();
    document.querySelector('#cms-registration-fields [name=title]')?.focus();
  };
  const editor = document.getElementById('cms-registration-fields');
  if (!editor) return;
  const picker = document.getElementById('cms-registration-select');
  picker.onchange = () => {
    if (!validateCapacity()) {
      picker.value = editedRegistrationId;
      return;
    }
    editedRegistrationId = picker.value;
    cmsRender();
  };
  const event = {...events.find(item => item.id === editedRegistrationId)};
  const enabled = editor.querySelector('[name=enabled]');
  const title = editor.querySelector('[name=title]');
  const layout = editor.querySelector('[name=layout]');
  const capacity = editor.querySelector('[name=capacity]');
  const map = editor.querySelector('[data-registration-editor-map]');
  function validateCapacity() { return capacity.reportValidity(); }
  const updateMap = () => {
    if (!capacity.checkValidity()) {
      map.replaceChildren();
      return;
    }
    event.layout = layout.value;
    event.capacity = capacity.valueAsNumber;
    drawRegistrationSeats(0, event, map);
  };
  layout.onchange = () => {
    if (capacity.valueAsNumber === REGISTRATION_FORMATS[event.layout || 'conference'][1]) {
      capacity.value = REGISTRATION_FORMATS[layout.value][1];
    }
    update();
  };
  title.maxLength = 120;
  const mark = () => {
    cmsWorking.registrationEvents = events.map(item => item.id === event.id ? event : item);
    picker.selectedOptions[0].textContent = (event.title || 'Novo evento') + (event.enabled ? ' · Ativado' : ' · Desativado');
    cmsMarkDirty();
  };
  const update = () => {
    updateMap();
    event.enabled = enabled.value === 'open';
    const missingTitle = event.enabled && !title.value.trim();
    title.required = event.enabled;
    title.setCustomValidity(missingTitle ? 'Informe o nome do evento.' : '');
    for (const name of ['title','description','schedule','venue']) {
      event[name] = editor.querySelector('[name='+name+']').value.trim();
    }
    mark();
  };
  enabled.onchange = () => {
    if (enabled.value === 'open' && !title.value.trim()) {
      enabled.value = 'closed';
      toast('Informe o nome do evento antes de ativar as inscrições.');
      title.focus();
      return;
    }
    update();
  };
  for (const input of editor.querySelectorAll('input:not([type=file]),textarea')) input.oninput = update;
  title.required = event.enabled === true;
  updateMap();
  const cover = editor.querySelector('[name=coverFile]');
  cover.onchange = async () => {
    if (!cover.files.length) return;
    cmsBusyState(editor,true,'Enviando capa…');
    add.disabled = picker.disabled = true;
    try {
      const image = await imageFile(cover);
      if (image) {
        event.cover = image;
        mark();
      }
    } catch (error) {
      toast(error.message);
    } finally {
      cmsBusyState(editor,false);
      add.disabled = picker.disabled = false;
      if (event.cover && capacity.checkValidity()) cmsRender();
    }
  };
  const removeCover = document.getElementById('cms-registration-remove-cover');
  if (removeCover) removeCover.onclick = () => {
    if (!validateCapacity()) return;
    event.cover = '';
    mark();
    cmsRender();
  };
}

function renderRegistrationPage(content, isPreview) {
  const list = document.getElementById('registration-list');
  const back = document.getElementById('registration-back');
  const waiting = document.getElementById('registration-waiting');
  const events = registrationEvents(content).filter(event => event?.enabled === true && event.id && event.title);
  const version = ++registrationListVersion;
  const selected = events.find(event => event.id === openRegistrationId);
  back.hidden = !selected;
  list.hidden = Boolean(selected) || !events.length;
  renderRegistrations(selected, isPreview);
  waiting.hidden = Boolean(events.length);
  if (selected) {
    back.onclick = () => {
      openRegistrationId = '';
      renderRegistrationPage(content, isPreview);
      list.querySelector('button')?.focus();
    };
    return;
  }
  openRegistrationId = '';
  const fragment = document.createDocumentFragment();
  const counters = [];
  for (const event of events) {
    const card = document.createElement('article');
    card.className = 'registration-card';
    const cover = document.createElement('img');
    const coverUrl = cmsImage(event.cover) || 'assets/videira-visita.jpg';
    cover.src = coverUrl;
    cover.alt = '';
    cover.loading = 'lazy';
    card.append(cover);
    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = event.title;
    copy.append(title);
    for (const value of [event.schedule, event.venue]) {
      if (!value) continue;
      const line = document.createElement('p');
      line.textContent = value;
      copy.append(line);
    }
    const count = document.createElement('p');
    count.className = 'registration-card-count';
    count.textContent = isPreview ? `Prévia · ${registrationCapacity(event)} vagas` : 'Consultando vagas…';
    const progress = document.createElement('progress');
    progress.max = registrationCapacity(event);
    progress.value = 0;
    progress.setAttribute('aria-label','Ocupação de ' + event.title);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary';
    button.textContent = 'Ver vagas e se inscrever';
    button.onclick = () => {
      openRegistrationId = event.id;
      renderRegistrationPage(content, isPreview);
      document.getElementById('registration-title').focus();
    };
    copy.append(count,progress,button);
    card.append(copy);
    fragment.append(card);
    counters.push({event,count,progress,button});
  }
  list.querySelector('.registration-cards').replaceChildren(fragment);
  if (!isPreview && counters.length) {
    async function updateCounters() {
      for (const {event,count,progress,button} of counters) {
        if (version !== registrationListVersion) return;
        try {
          const result = await registrationRequest(event);
          if (version !== registrationListVersion) return;
          const capacity = result.capacity ?? registrationCapacity(event);
          progress.max = capacity;
          count.textContent = result.active ? `${result.confirmed} de ${capacity} vagas preenchidas` : 'Inscrições encerradas';
          progress.value = result.confirmed || 0;
          button.disabled = !result.active;
        } catch {
          count.textContent = 'Consulte as vagas no evento.';
        }
      }
    }
    updateCounters();
  }
}

function frontRegistrationSeats(total, firstRow = 0) {
  const seats = [];
  for (let i = 0; i < total; i++) {
    const row = firstRow + Math.floor(i / 12);
    const column = Math.floor((i % 12) / 2);
    seats.push([720 + (i % 2 ? 1 : -1) * (39 + column * 26), 640 - row * 30, 0, i % 2 ? "Central · Direita" : "Central · Esquerda"]);
  }
  return seats;
}
function conferenceRegistrationSeats(total) {
  const groups = [frontRegistrationSeats(96)];
  const tilt = Math.PI / 9;
  const rows = [6, 7, 8, 8, 9, 9, 10, 10];
  for (const side of [-1, 1]) {
    groups.push(rows.flatMap((n, row) => Array.from({length:n}, (_, col) => [
      720 + side * (211 + row * 12 + col * 26 * Math.cos(tilt)),
      640 - row * 30 + col * 26 * Math.sin(tilt), side * 20, side < 0 ? "Diagonal · Esquerda" : "Diagonal · Direita"
    ])));
    groups.push(Array.from({length:35}, (_, i) => [
      720 + side * (350 + Math.floor(i / 5) * 29), 731 + i % 5 * 26, side * 90, side < 0 ? "Lateral · Esquerda" : "Lateral · Direita"
    ]));
  }
  const ordered = groups.flatMap(group => group.map((seat, i) => ({seat, order:(i + .5) / group.length})));
  ordered.sort((a,b) => a.order - b.order);
  return ordered.slice(0, total).map(item => item.seat).concat(frontRegistrationSeats(Math.max(0,total-300),8));
}
function workshopRegistrationSeats(total) {
  const seats = [];
  for (let row = 0; seats.length < total; row++) {
    const sides = [
      offset => [610 - row * 30, 535 + offset, -90, "Lateral · Esquerda"],
      offset => [830 + row * 30, 535 + offset, 90, "Lateral · Direita"]
    ];
    if (row < 3) {
      sides.push(
        offset => [720 + offset, 535 + 104 + row * 30, 180, "Frente do palco"],
        offset => [720 + offset, 535 - 104 - row * 30, 0, "Lado oposto ao palco"]
      );
    }
    for (const position of sides) {
      const rowSize = Math.min(5, total - seats.length);
      for (let i = 0; i < rowSize; i++) {
        seats.push(position((i - (rowSize - 1) / 2) * 29));
      }
    }
  }
  return seats;
}
function couplesRegistrationSeats(total) {
  const tables = [];
  const seats = [];
  for (let i = 0; i < Math.ceil(total / 4); i++) {
    const row = Math.floor(i / 5);
    const tablesInRow = Math.min(5, Math.ceil(total / 4) - row * 5);
    const x = 720 + ((i % 5) - (tablesInRow - 1) / 2) * 155 + (row % 2 ? 20 : -20);
    const y = 659 - row * 102;
    tables.push([x, y]);
    seats.push(...[[x,y-34,0],[x,y+34,180],[x-34,y,-90],[x+34,y,90]].slice(0, Math.min(4,total-i*4)).map(seat => [...seat, "Mesa " + (i + 1)]));
  }
  return {tables, seats};
}
function drawRegistrationSeats(confirmed, event, target = document.getElementById('registration-seats')) {
  const capacity = registrationCapacity(event);
  const layout = event.layout || 'conference';
  const {tables, seats: points} = layout === 'couples' ? couplesRegistrationSeats(capacity) : {
    tables: [],
    seats: layout === 'front' ? frontRegistrationSeats(capacity) :
      layout === 'workshop' ? workshopRegistrationSeats(capacity) : conferenceRegistrationSeats(capacity)
  };
  const chairId = target.id === 'registration-seats' ? 'registration-chair' : 'registration-editor-chair';
  points.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const sectors = new Map();
  points.forEach(([x, y, angle, label], i) => {
    if (!sectors.has(label)) sectors.set(label, []);
    sectors.get(label).push({x, y, angle, occupied: i < confirmed});
  });
  const chairs = [...sectors].map(([label, seats]) => {
    const {x, y, angle} = seats[0];
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const local = seats.map(seat => ({
      x: (seat.x - x) * cos + (seat.y - y) * sin,
      y: -(seat.x - x) * sin + (seat.y - y) * cos,
      occupied: seat.occupied
    }));
    const left = Math.min(...local.map(seat => seat.x)) - 14;
    const top = Math.min(...local.map(seat => seat.y)) - 12;
    const width = Math.max(...local.map(seat => seat.x)) + 14 - left;
    const height = Math.max(...local.map(seat => seat.y)) + 12 - top;
    const bounds = `x="${left}" y="${top}" width="${width}" height="${height}" rx="8"`;
    const outline = className => {
      if (layout === 'couples') return '';
      if (!label.startsWith('Diagonal')) return `<rect class="${className}" ${bounds}/>`;
      // Trim the unused corner before the aisle, in the map's coordinate space.
      const limit = 708;
      const corners = [[left, top], [left + width, top],
        [left + width, top + height], [left, top + height]];
      const worldY = ([px, py]) => y + px * sin + py * cos;
      const clipped = corners.flatMap((start, i) => {
        const end = corners[(i + 1) % corners.length];
        const from = worldY(start), to = worldY(end);
        const vertices = from <= limit ? [start] : [];
        if ((from <= limit) !== (to <= limit)) {
          const fraction = (limit - from) / (to - from);
          vertices.push(start.map((value, axis) => value + fraction * (end[axis] - value)));
        }
        return vertices;
      });
      return `<polygon class="${className}" points="${clipped.map(point => point.join(',')).join(' ')}" stroke-linejoin="round"/>`;
    };
    const seatsMarkup = local.map(seat =>
      `<use href="#${chairId}" class="${seat.occupied ? 'confirmed' : 'available'}" transform="translate(${seat.x} ${seat.y})"/>`
    ).join('');
    return `<g class="registration-sector" transform="translate(${x} ${y}) rotate(${angle})">
      <title>${label}</title>
      ${outline('registration-sector-hit')}
      <g class="registration-sector-platform">
        <g transform="translate(0 6)">${outline('registration-sector-edge')}</g>
        ${outline('registration-sector-surface')}
        ${seatsMarkup}
      </g>
    </g>`;
  });
  const stageY = layout === 'workshop' ? 744 : 722;
  const left = Math.min(515, ...points.map(([x]) => x)) - 30;
  const right = Math.max(925, ...points.map(([x]) => x)) + 30;
  const top = Math.min(425, ...points.map(([,y]) => y)) - 30;
  const bottom = Math.max(stageY + 89, ...points.map(([,y]) => y)) + 24;
  const hasAisle = layout === 'conference' || layout === 'front';
  target.innerHTML = `<svg viewBox="${left} ${top} ${right-left} ${bottom-top}" role="img" aria-label="Mapa com ${capacity} ${capacity === 1 ? 'cadeira' : 'cadeiras'}">
    <defs><g id="${chairId}"><rect x="-11" y="-9" width="22" height="17" rx="4"/><path d="M-9 5h18"/></g></defs>
    ${tables.map(([x,y],i) => `<circle cx="${x}" cy="${y}" r="22" fill="#ede4f6" stroke="#ba9ad7"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="13" fill="var(--purple)">${i+1}</text>`).join('')}
    ${chairs.join('')}
    <rect x="533" y="${stageY}" width="374" height="89" rx="13" fill="var(--purple)"/>
    <text x="720" y="${stageY + 52}" fill="white" text-anchor="middle">PALCO</text>
    ${hasAisle ? '<text class="registration-aisle" transform="translate(724 563) rotate(-90)" text-anchor="middle">Corredor central</text>' : ''}
  </svg>`;
}

async function registrationRequest(event, fields = {}) {
  const config = window.VIDEIRA_CONFIG;
  const endpoint = fields.p_whatsapp ? 'videira_event_registration_v3' : 'videira_event_registration_v2';
  const response = await fetch(config.url + '/rest/v1/rpc/' + endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: {apikey: config.publicKey, Authorization: 'Bearer ' + config.publicKey, 'Content-Type': 'application/json'},
    body: JSON.stringify({p_event_id: event.id, ...fields})
  });
  if (!response.ok) throw Error('Não foi possível conectar às inscrições. Tente novamente em instantes.');
  return response.json();
}

function renderRegistrations(event, isPreview) {
  const panel = document.getElementById('registration-event');
  const waiting = document.getElementById('registration-waiting');
  const form = document.getElementById('registration-form');
  const status = document.getElementById('registration-status');
  const button = form.querySelector('button');
  const enabled = event?.enabled === true && Boolean(event.id && event.title);
  clearTimeout(registrationRefreshTimer);
  const view = {submitting: false, refreshing: false, submission: 0, confirmed: 0, capacity: enabled ? registrationCapacity(event) : 0};
  displayedRegistration = view;
  waiting.hidden = enabled;
  panel.hidden = !enabled;
  button.disabled = true;
  form.onsubmit = null;
  form.reset();
  window.VideiraPhone.bind(form.elements.whatsapp);
  const cpf = form.elements.cpf;
  cpf.oninput = () => {
    cpf.value = cpf.value.replace(/\D/g, '').slice(0, 11)
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2');
  };
  status.textContent = '';
  if (!enabled) return;
  document.getElementById('registration-title').textContent = event.title;
  document.getElementById('registration-description').textContent = event.description || '';
  const count = document.getElementById('registration-count');
  count.textContent = isPreview ? `Prévia · ${registrationCapacity(event)} vagas` : 'Consultando disponibilidade…';
  drawRegistrationSeats(0, event);
  if (isPreview) return;

  const show = result => {
    if (!result.active) {
      clearTimeout(registrationRefreshTimer);
      waiting.hidden = false;
      panel.hidden = true;
      return;
    }
    const capacity = result.capacity ?? registrationCapacity(event);
    count.textContent = `${result.confirmed} de ${capacity} vagas preenchidas`;
    if (view.confirmed !== result.confirmed || view.capacity !== capacity) {
      drawRegistrationSeats(result.confirmed, {...event, capacity});
      view.capacity = capacity;
      view.confirmed = result.confirmed;
    }
    button.disabled = result.confirmed >= capacity;
    if (button.disabled) status.textContent = 'Inscrições lotadas.';
  };
  const fail = error => {
    if (displayedRegistration === view) status.textContent = error.message;
  };
  form.onsubmit = async e => {
    e.preventDefault();
    if (button.disabled || displayedRegistration !== view) return;
    const fields = new FormData(form);
    const phone = fields.get('whatsapp').trim();
    const digits = phone.replace(/\D/g, '');
    const national = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
    if ((phone.startsWith('+') && !digits.startsWith('55')) || !/^[1-9][0-9]{9,10}$/.test(national)) {
      status.textContent = 'Informe o DDD e o número do WhatsApp do Brasil.';
      form.elements.whatsapp.focus();
      return;
    }
    const whatsapp = '+55' + national;
    view.submission++;
    view.submitting = true;
    button.disabled = true;
    status.textContent = 'Enviando inscrição…';
    try {
      const result = await registrationRequest(event, {p_name: fields.get('name'), p_email: fields.get('email'), p_cpf: fields.get('cpf').replace(/\D/g, ''), p_role: fields.get('role'), p_payment: fields.get('payment'), p_whatsapp: whatsapp});
      if (displayedRegistration !== view) return;
      status.textContent = '';
      show(result);
      if (result.status === 'received') {
        form.reset();
        status.textContent = 'Inscrição recebida.';
      } else if (result.status === 'invalid') {
        status.textContent = 'Confira o CPF e os demais dados da inscrição.';
      }
    } catch (error) {
      fail(error);
      if (displayedRegistration === view) button.disabled = false;
    } finally {
      view.submitting = false;
    }
  };
  let retryDelay = 15000;
  const refresh = async () => {
    if (view.submitting || view.refreshing) return;
    view.refreshing = true;
    const submission = view.submission;
    try {
      const result = await registrationRequest(event);
      retryDelay = 15000;
      if (displayedRegistration === view && !view.submitting && view.submission === submission) {
        if (status.textContent === view.refreshError) status.textContent = '';
        show(result);
      }
    } catch (error) {
      retryDelay = Math.min(retryDelay * 2, 120000);
      if (button.disabled && !view.submitting) {
        view.refreshError = error.message;
        fail(error);
      }
    } finally {
      view.refreshing = false;
    }
  };
  const scheduleRefresh = () => {
    registrationRefreshTimer = setTimeout(async () => {
      if (displayedRegistration !== view || panel.hidden) return;
      if (!document.hidden && document.getElementById('page-inscricoes').classList.contains('active')) {
        await refresh();
      }
      if (displayedRegistration === view && !panel.hidden) scheduleRefresh();
    }, retryDelay + Math.random() * 3000);
  };
  refresh().finally(() => {
    if (displayedRegistration === view && !panel.hidden) scheduleRefresh();
  });
}
