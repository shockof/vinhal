'use strict';

(() => {
  const track = document.getElementById('visit-carousel-track');
  if (!track) return;

  const existingCards = [...track.children];
  const sections = ['pilar', 'satuba', 'antonio-lins', 'rio-largo', 'sao-luis-do-quitunde'];
  CMS_GROUPS.splice(2, sections.length, ['visitas', 'Venha nos visitar', 'church']);

  const fields = [
    ['title', 'Nome da igreja', 'h3', 'texts'],
    ['kicker', 'Localidade ou chamada', '.kicker', 'texts'],
    ['address', 'Endereço', 'p', 'texts'],
    ['description', 'Descrição', null, 'texts'],
    ['map', 'Link do Google Maps', '.contact-row a:first-child', 'links'],
    ['instagram', 'Link do Instagram', '.church-instagram', 'links'],
    ['photo', 'Link da foto', '.location-photo img', 'images'],
  ];

  const bindings = existingCards.map((card, index) => {
    const info = {};
    for (const [name, , selector, collection] of fields) {
      const element = selector ? card.querySelector(selector) : card.querySelectorAll('p')[1];
      const key = element?.dataset[{ texts: 'cmsText', links: 'cmsLink', images: 'cmsImage' }[collection]]
        || 'visit-' + (sections[index - 1] || 'maceio') + '-' + name;
      const fallback = element?.getAttribute(collection === 'links' ? 'href' : 'src')
        || element?.textContent.trim() || '';
      info[name] = { key, collection, fallback };
    }
    return info;
  });

  const getValue = (content, { collection, key, fallback }) => content[collection]?.[key] ?? fallback;
  let selectedCard = 0;

  function readCard(content, index) {
    const builtIn = bindings[index];
    return builtIn
      ? Object.fromEntries(Object.entries(builtIn).map(([name, binding]) => [name, getValue(content, binding)]))
      : content.visitCards?.[index - bindings.length];
  }

  function writeField(index, name, value) {
    const binding = bindings[index]?.[name];
    if (binding) cmsWorking[binding.collection][binding.key] = value;
    else cmsWorking.visitCards[index - bindings.length][name] = value;
    cmsMarkDirty();
  }

  const previousPageEditor = cmsPageEditor;
  cmsPageEditor = function (group) {
    if (group !== 'visitas') return previousPageEditor(group);
    const count = bindings.length + (Array.isArray(cmsWorking.visitCards) ? cmsWorking.visitCards.length : 0);
    selectedCard = Math.min(selectedCard, count - 1);
    const card = readCard(cmsWorking, selectedCard);
    return `<h2>Venha nos visitar</h2>
      <div class="cms-form-grid">
        <label>Igreja<select id="visitEditorSelection">${Array.from({ length: count }, (_, i) =>
          `<option value="${i}" ${i === selectedCard ? 'selected' : ''}>${esc(readCard(cmsWorking, i).title || 'Nova igreja')}</option>`).join('')}</select></label>
        <div><button type="button" class="dash-button" id="visitEditorAdd">Adicionar igreja</button></div>
        ${fields.map(([name, label, , collection]) =>
          cmsField(label, 'visit-' + name, name === 'photo' && !card[name]?.startsWith('https://') ? '' : card[name] || '', collection === 'texts' ? 'text' : 'url')).join('')}
        <label>Carregar foto<input type="file" id="visitEditorPhoto" accept="image/png,image/jpeg,image/webp"></label>
        <img width="160" src="${esc(cmsImage(card.photo) || 'assets/logo.png')}" alt="Foto atual do cartão">
      </div>`;
  };

  const previousBind = cmsBind;
  cmsBind = function () {
    previousBind();
    if (!$('#visitEditorSelection')) return;
    const index = selectedCard;
    $('#visitEditorSelection').onchange = event => {
      selectedCard = Number(event.target.value);
      cmsRender();
    };
    $('#visitEditorAdd').onclick = () => {
      if (!Array.isArray(cmsWorking.visitCards)) cmsWorking.visitCards = [];
      cmsWorking.visitCards.push({ title: 'Nova igreja' });
      selectedCard = bindings.length + cmsWorking.visitCards.length - 1;
      cmsMarkDirty();
      cmsRender();
      $('[name=visit-title]').select();
    };
    for (const [name, , , collection] of fields) {
      const input = $('[name=visit-' + name + ']');
      input.oninput = () => {
        const value = input.value.trim();
        const valid = collection === 'texts' || !value || cmsLink(value).startsWith('https://');
        input.setCustomValidity(valid ? '' : 'Informe um link HTTPS válido.');
        if (valid) writeField(index, name, value);
        if (name === 'title') $('#visitEditorSelection').selectedOptions[0].textContent = value || 'Nova igreja';
      };
    }
    const photo = $('#visitEditorPhoto');
    photo.onchange = async () => {
      cmsBusy = true;
      const working = cmsWorking;
      try {
        const url = await imageFile(photo);
        if (url && cmsWorking === working) {
          writeField(index, 'photo', url);
          if (cmsActive === 'visitas') cmsRender();
        }
      } catch (error) {
        toast(error.message);
      } finally {
        cmsBusy = false;
      }
    };
  };

  const previousApply = applyContent;
  applyContent = function (content) {
    previousApply(content);
    const normalized = cmsNormalize(content);
    existingCards.forEach((element, index) => {
      const card = readCard(normalized, index);
      for (const name of ['address', 'description']) {
        let paragraph = element.querySelector(name === 'address' ? 'p' : 'p:nth-of-type(2)');
        if (!paragraph && card[name]) {
          paragraph = document.createElement('p');
          element.querySelector('.contact-row').before(paragraph);
        }
        if (paragraph) {
          paragraph.textContent = card[name];
          paragraph.hidden = !card[name];
        }
      }
      for (const [name, selector] of [['map', 'a:first-child'], ['instagram', '.church-instagram']]) {
        element.querySelector('.contact-row ' + selector).hidden = !cmsLink(card[name]).startsWith('https://');
      }
      element.querySelector('img').src = cmsImage(card.photo) || 'assets/logo.png';
    });
    track.querySelectorAll('[data-added-visit]').forEach(card => card.remove());
    const added = Array.isArray(normalized.visitCards) ? normalized.visitCards : [];
    for (const card of added) {
      if (typeof card?.title !== 'string' || !card.title.trim()) continue;
      const link = (url, label, className = '') => {
        const href = cmsLink(url);
        return href.startsWith('https://') ? `<a class="${className}" href="${esc(href)}" target="_blank" rel="noreferrer">${label}</a>` : '';
      };
      track.insertAdjacentHTML('beforeend', `<div class="location-panel" data-added-visit>
        <div class="location-photo"><img src="${esc(cmsImage(card.photo) || 'assets/logo.png')}" alt="" loading="lazy"></div>
        <div class="location-info">
          ${card.kicker ? `<div class="kicker">${esc(card.kicker)}</div>` : ''}
          <h3>${esc(card.title)}</h3>
          ${card.address ? `<p>${esc(card.address)}</p>` : ''}
          ${card.description ? `<p>${esc(card.description)}</p>` : ''}
          <div class="contact-row">${link(card.map, '⌖ Como chegar')}${link(card.instagram, 'Instagram', 'church-instagram')}</div>
        </div></div>`);
    }
    track.dispatchEvent(new Event('visit-cards-changed'));
  };

  publicRefresh();
})();
