'use strict';
(() => {
  const config = window.VIDEIRA_CONFIG;
  if (!config || new URLSearchParams(location.search).get('editor') === '1') return;

  const labels = {
    supervisor: 'Pastor (a) Supervisor (a)',
    predio: 'Pastor (a) de prédio',
    pastor: 'Pastor (a) de rede',
    obreiro: 'Obreiro (a)',
    discipulador: 'Discipulador (a)',
    lider: 'Líder de célula'
  };
  const sections = [
    ['pastoralProfiles', ['supervisor', 'predio', 'pastor', 'obreiro']],
    ['leaderProfiles', ['discipulador', 'lider']]
  ];

  async function rpc(action, params = {}) {
    const response = await fetch(config.url + '/rest/v1/rpc/' + action, {
      method: 'POST',
      headers: {apikey: config.publicKey, Authorization: 'Bearer ' + config.publicKey, 'Content-Type': 'application/json'},
      body: JSON.stringify(params)
    });
    if (!response.ok) throw Error('Diretório indisponível');
    return response.json();
  }

  function render(profiles) {
    for (const [id, roles] of sections) {
      const container = document.getElementById(id);
      const entries = profiles.filter(profile => roles.includes(profile.role));
      container.innerHTML = entries.map(profile => `<article class="person" id="perfil-${esc(profile.id)}">
        <div class="profile-initials" aria-hidden="true">${esc(profile.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase())}</div>
        <div class="person-copy"><h3>${esc(profile.name)}</h3>
        <p>${esc(labels[profile.role])}${profile.church ? '<br>' + esc(profile.church) : ''}</p></div>
      </article>`).join('') || '<p>Nenhum perfil disponível nesta seção.</p>';
      for (const profile of entries.filter(entry => entry.photo)) {
        const avatar = document.getElementById('perfil-' + profile.id).firstElementChild;
        rpc('videira_public_leadership_photo', {p_id: profile.id}).then(photo => {
          if (!photo || !avatar.isConnected) return;
          const image = document.createElement('img');
          image.className = 'profile-photo';
          image.alt = '';
          image.src = 'data:image/jpeg;base64,' + photo;
          image.onload = () => avatar.replaceWith(image);
        }).catch(() => {});
      }
    }
    if (location.hash.startsWith('#perfil-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  let loaded = false;
  let loading = false;
  publicProfiles = () => {};
  for (const [id] of sections) document.getElementById(id).textContent = 'Carregando perfis…';
  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const profiles = await rpc('videira_public_leadership');
      if (!Array.isArray(profiles)) throw Error('Diretório indisponível');
      render(profiles);
      loaded = true;
    } catch {
      if (!loaded) for (const [id] of sections) document.getElementById(id).textContent = 'Não foi possível carregar os perfis.';
    } finally {
      loading = false;
    }
  }
  refresh();
  window.addEventListener('hashchange', () => {
    if (/^#(lideranca|equipe|perfil-)/.test(location.hash)) refresh();
  });
})();
