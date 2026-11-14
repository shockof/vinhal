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

  function maceioPastor(profile) {
    const church = String(profile.church || '').normalize('NFD')
      .replace(/\p{M}/gu, '').trim().toLowerCase();
    return ['supervisor', 'predio', 'pastor'].includes(profile.role) && church === 'videira maceio';
  }

  function render(entries) {
    for (const [id, roles] of sections) {
      const container = document.getElementById(id);
      const cards = document.createDocumentFragment();
      const visible = entries.filter(({profile}) => roles.includes(profile.role));
      if (id === 'pastoralProfiles') {
        visible.sort((a, b) => Number(maceioPastor(b.profile)) - Number(maceioPastor(a.profile)));
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
