'use strict';

let displayedRegistration;
let registrationRefreshTimer;

function registrationEditor() {
  const event = cmsWorking.registrations || {};
  return `<h2>Inscrições</h2>
    <p>Salve o rascunho e publique para atualizar a página. Desativar preserva as inscrições do evento.</p>
    <label>Inscrições<select id="cms-registration-enabled">
      <option value="closed">Desativadas</option>
      <option value="open" ${event.enabled === true ? 'selected' : ''}>Ativadas</option>
    </select></label>
    <label>Nome do evento<input id="cms-registration-title" maxlength="120" value="${esc(event.title || '')}"></label>
    <label>Informações do evento<textarea id="cms-registration-description" maxlength="1000">${esc(event.description || '')}</textarea></label>
    ${event.id ? '<button type="button" class="dash-button" id="cms-registration-new">Preparar outro evento</button>' : ''}
    <p>Ao preparar outro evento, a contagem começa em zero após a publicação.</p>`;
}

function bindRegistrationEditor() {
  const enabled = document.getElementById('cms-registration-enabled');
  if (!enabled) return;
  const title = document.getElementById('cms-registration-title');
  const description = document.getElementById('cms-registration-description');
  title.required = enabled.value === 'open';
  const update = () => {
    const active = enabled.value === 'open';
    title.required = active;
    title.setCustomValidity(active && !title.value.trim() ? 'Informe o nome do evento.' : '');
    cmsWorking.registrations = {
      id: cmsWorking.registrations?.id || crypto.randomUUID(),
      enabled: active,
      title: title.value.trim(),
      description: description.value.trim()
    };
    cmsMarkDirty();
  };
  enabled.onchange = title.oninput = description.oninput = update;
  const next = document.getElementById('cms-registration-new');
  if (next) next.onclick = () => {
    if (!confirm('Preparar outro evento com uma nova contagem de vagas?')) return;
    cmsWorking.registrations = {id: crypto.randomUUID(), enabled: false, title: '', description: ''};
    cmsMarkDirty();
    cmsRender();
  };
}

function drawRegistrationSeats(confirmed) {
  const points = [];
  const tilt = Math.PI / 9;
  const diagonal = [6, 7, 8, 8, 9, 9, 10, 10];
  for (const side of [-1, 1]) {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        points.push([720 + side * (350 + row * 29), 731 + col * 26, side * 90]);
      }
    }
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 6; col++) {
        points.push([720 + side * (39 + col * 26), 640 - row * 30, 0]);
      }
    }
    diagonal.forEach((count, row) => {
      for (let col = 0; col < count; col++) {
        const x = 211 + row * 12 + col * 26 * Math.cos(tilt);
        const y = 640 - row * 30 + col * 26 * Math.sin(tilt);
        points.push([720 + side * x, y, side * 20]);
      }
    });
  }
  points.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const chairs = points.map(([x, y, angle], i) =>
    `<use href="#registration-chair" class="${i < confirmed ? 'confirmed' : 'available'}" transform="translate(${x} ${y}) rotate(${angle})"/>`
  );
  document.getElementById('registration-seats').innerHTML = `<svg viewBox="160 407 1120 445" role="img" aria-label="Mapa do auditório com 300 cadeiras">
    <defs><g id="registration-chair"><rect x="-11" y="-9" width="22" height="17" rx="4"/><path d="M-9 5h18"/></g></defs>
    ${chairs.join('')}
    <rect x="533" y="722" width="374" height="89" rx="13" fill="var(--purple)"/>
    <text x="720" y="775" fill="white" text-anchor="middle">PALCO</text>
    <text class="registration-aisle" transform="translate(724 563) rotate(-90)" text-anchor="middle">Corredor central</text>
  </svg>`;
}

async function registrationRequest(event, fields = {}) {
  const config = window.VIDEIRA_CONFIG;
  const response = await fetch(config.url + '/rest/v1/rpc/videira_event_registration', {
    method: 'POST',
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
  clearInterval(registrationRefreshTimer);
  const view = {submitting: false, refreshing: false, submission: 0, confirmed: 0};
  displayedRegistration = view;
  waiting.hidden = enabled;
  panel.hidden = !enabled;
  button.disabled = true;
  form.reset();
  status.textContent = '';
  if (!enabled) return;
  document.getElementById('registration-title').textContent = event.title;
  document.getElementById('registration-description').textContent = event.description || '';
  const count = document.getElementById('registration-count');
  count.textContent = isPreview ? 'Prévia · 300 vagas' : 'Consultando disponibilidade…';
  drawRegistrationSeats(0);
  if (isPreview) return;

  const show = result => {
    if (!result.active) {
      clearInterval(registrationRefreshTimer);
      waiting.hidden = false;
      panel.hidden = true;
      return;
    }
    count.textContent = `${result.confirmed} de 300 inscrições confirmadas`;
    if (view.confirmed !== result.confirmed) {
      drawRegistrationSeats(result.confirmed);
      view.confirmed = result.confirmed;
    }
    button.disabled = result.confirmed >= 300;
    if (button.disabled) status.textContent = 'Inscrições lotadas.';
  };
  const fail = error => {
    if (displayedRegistration === view) status.textContent = error.message;
  };
  form.onsubmit = async e => {
    e.preventDefault();
    if (button.disabled || displayedRegistration !== view) return;
    const fields = new FormData(form);
    view.submission++;
    view.submitting = true;
    button.disabled = true;
    status.textContent = 'Enviando inscrição…';
    try {
      const result = await registrationRequest(event, {p_name: fields.get('name'), p_email: fields.get('email')});
      if (displayedRegistration !== view) return;
      status.textContent = '';
      show(result);
      if (result.status === 'received') {
        form.reset();
        status.textContent = 'Inscrição recebida.';
      } else if (result.status === 'invalid') {
        status.textContent = 'Confira o nome e o e-mail informados.';
      }
    } catch (error) {
      fail(error);
      if (displayedRegistration === view) button.disabled = false;
    } finally {
      view.submitting = false;
    }
  };
  const refresh = async () => {
    if (view.submitting || view.refreshing) return;
    view.refreshing = true;
    const submission = view.submission;
    try {
      const result = await registrationRequest(event);
      if (displayedRegistration === view && !view.submitting && view.submission === submission) {
        if (status.textContent === view.refreshError) status.textContent = '';
        show(result);
      }
    } catch (error) {
      if (button.disabled && !view.submitting) {
        view.refreshError = error.message;
        fail(error);
      }
    } finally {
      view.refreshing = false;
    }
  };
  refresh();
  registrationRefreshTimer = setInterval(() => {
    if (!document.hidden && document.getElementById('page-inscricoes').classList.contains('active')) refresh();
  }, 15000);
}
