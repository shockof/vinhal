'use strict';
(() => {
  const config = window.VIDEIRA_CONFIG;
  if (!config || new URLSearchParams(location.search).get('editor') === '1') return;

  const labels = {
    supervisor: 'Pastor (a) Supervisor (a)',
    predio: 'Pastor (a) de prédio',
    pastor: 'Pastor (a) de rede',
    obreiro: 'Obreiro (a)',
    discipulador: 'Discipulador (a)'
  };
  const sections = [
    ['pastoralProfiles', ['supervisor', 'predio', 'pastor', 'obreiro']],
    ['leaderProfiles', ['discipulador']]
  ];

  function setupCarousel(id) {
    const track = document.getElementById(id);
    const title = track.closest('section').querySelector('h2');
    const frame = document.createElement('div');
    frame.className = 'leadership-carousel';
    track.before(frame);
    frame.append(track);
    track.classList.add('leadership-track');
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', title.textContent.trim());

    function arrow(direction, label, symbol) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'leadership-arrow ' + (direction < 0 ? 'previous' : 'next');
      button.setAttribute('aria-label', label + ' — ' + title.textContent.trim());
      button.setAttribute('aria-controls', id);
      button.textContent = symbol;
      button.hidden = true;
      button.onclick = () => {
        const cards = [...track.querySelectorAll('.person')];
        const start = cards[0].offsetLeft;
        const positions = cards.map(card => card.offsetLeft - start);
        const left = direction > 0
          ? positions.find(position => position > track.scrollLeft + 2)
          : positions.reverse().find(position => position < track.scrollLeft - 2);
        track.scrollTo({left: left ?? 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      };
      frame.append(button);
      return button;
    }

    const previous = arrow(-1, 'Anterior', '‹');
    const next = arrow(1, 'Próximo', '›');
    function update() {
      const limit = track.scrollWidth - track.clientWidth;
      const available = track.clientWidth > 0 && limit > 2;
      previous.hidden = next.hidden = !available;
      previous.disabled = track.scrollLeft < 2;
      next.disabled = track.scrollLeft >= limit - 2;
    }
    track.addEventListener('scroll', update, {passive: true});
    new ResizeObserver(update).observe(track);
    return update;
  }

  const updateCarousels = new Map(sections.map(([id]) => [id, setupCarousel(id)]));

  async function rpc(action, params = {}) {
    const response = await fetch(config.url + '/rest/v1/rpc/' + action, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {apikey: config.publicKey, Authorization: 'Bearer ' + config.publicKey, 'Content-Type': 'application/json'},
      body: JSON.stringify(params)
    });
    if (!response.ok) throw Error('Diretório indisponível');
    return response.json();
  }

  async function loadPhoto(profile) {
    if (!profile.photo) return null;
    try {
      const photo = await rpc('videira_public_leadership_photo', {p_id: profile.id});
      if (typeof photo !== 'string' || !photo) return null;
      const image = new Image();
      image.className = 'profile-photo';
      image.alt = '';
      image.src = 'data:image/jpeg;base64,' + photo;
      await image.decode();
      return image;
    } catch {
      return null;
    }
  }

  function pastoralPriority(profile) {
    if (profile.role === 'supervisor') return 0;
    if (profile.role === 'obreiro') return 3;
    const church = String(profile.church || '').normalize('NFD')
      .replace(/\p{M}/gu, '').trim().toLowerCase();
    return profile.role === 'pastor' && church === 'videira maceio' ? 1 : 2;
  }

  function render(entries) {
    for (const [id, roles] of sections) {
      const container = document.getElementById(id);
      const cards = document.createDocumentFragment();
      const visible = entries.filter(({profile}) => roles.includes(profile.role));
      if (id === 'pastoralProfiles') {
        visible.sort((a, b) => pastoralPriority(a.profile) - pastoralPriority(b.profile));
      }
      for (const {profile, image} of visible) {
        const card = document.createElement('article');
        card.className = 'person';
        card.id = 'perfil-' + profile.id;
        card.innerHTML = `<div class="person-copy"><h3>${esc(profile.name)}</h3>
          <p>${esc(labels[profile.role])}${profile.church ? '<br>' + esc(profile.church) : ''}</p></div>`;
        if (image) {
          card.prepend(image);
        } else {
          const initials = document.createElement('div');
          initials.className = 'profile-initials';
          initials.setAttribute('aria-hidden', 'true');
          initials.textContent = profile.name.trim().split(/\s+/).slice(0, 2)
            .map(word => word.charAt(0)).join('').toUpperCase();
          card.prepend(initials);
        }
        cards.append(card);
      }
      if (!cards.childNodes.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Nenhum perfil disponível nesta seção.';
        cards.append(empty);
      }
      container.replaceChildren(cards);
      updateCarousels.get(id)();
    }
    if (location.hash.startsWith('#perfil-')) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior: 'instant'});
    }
  }

  let signature = null;
  let lastLoaded = 0;
  let loading = false;
  publicProfiles = () => {};
  for (const [id] of sections) document.getElementById(id).textContent = 'Carregando perfis…';

  async function refresh() {
    if (loading || Date.now() - lastLoaded < 60000) return;
    loading = true;
    try {
      const profiles = await rpc('videira_public_leadership');
      if (!Array.isArray(profiles)) throw Error('Diretório indisponível');
      const entries = await Promise.all(profiles.map(async profile => ({
        profile,
        image: await loadPhoto(profile)
      })));
      const nextSignature = JSON.stringify(entries.map(({profile, image}) => [profile, image?.src]));
      if (nextSignature !== signature) {
        render(entries);
        signature = nextSignature;
      }
      lastLoaded = Date.now();
    } catch {
      if (signature === null) {
        for (const [id] of sections) document.getElementById(id).textContent = 'Não foi possível carregar os perfis.';
      }
    } finally {
      loading = false;
    }
  }
  refresh();
  window.addEventListener('videira:navigation', () => {
    if (/^#(lideranca|equipe|perfil-)/.test(location.hash)) refresh();
  });
})();
