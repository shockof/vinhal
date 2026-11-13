'use strict';
window.VideiraLeadershipPhoto = (() => {
  async function request(token, id, photo) {
    const config = window.VIDEIRA_CONFIG;
    const response = await fetch(config.url + '/rest/v1/rpc/videira_leadership_photo', {
      method: 'POST',
      headers: {apikey: config.publicKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
      body: JSON.stringify({p_id: id, p_photo: photo})
    });
    if (!response.ok) {
      const error = Error('Não foi possível acessar a foto da conta. Confira a sessão e tente novamente.');
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function field() {
    return `<div class="profile-photo-row wide" data-leadership-photo>
      <div class="profile-avatar" data-photo-preview aria-label="Prévia da foto"></div>
      <div><label>Foto da liderança (opcional)<input type="file" accept="image/jpeg,image/png,image/webp"></label>
      <small>As fotos deste campo aparecem no site nas seções de liderança. A conta Master fica fora dessas seções.</small>
      <div class="actions"><button type="button" class="secondary" data-photo-adjust hidden>Ajustar enquadramento</button>
      <button type="button" class="secondary" data-photo-remove hidden>Remover foto</button></div>
      <p role="status"></p></div>
    </div>`;
  }

  function bind(form, isSaving, requestPhoto, id) {
    const root = form.querySelector('[data-leadership-photo]');
    const preview = root.querySelector('[data-photo-preview]');
    const file = root.querySelector('input');
    const adjust = root.querySelector('[data-photo-adjust]');
    const remove = root.querySelector('[data-photo-remove]');
    const status = root.querySelector('[role=status]');
    const state = {value: undefined, processing: false};
    let source, position, existing;
    function show(value) {
      preview.textContent = '—';
      adjust.hidden = remove.hidden = !value;
      if (!value) return;
      const image = document.createElement('img');
      image.src = 'data:image/jpeg;base64,' + value;
      image.alt = 'Foto da liderança';
      preview.replaceChildren(image);
    }
    show();
    if (id) requestPhoto(id).then(({photo}) => {
      existing = photo;
      if (root.isConnected && state.value === undefined) show(photo);
    }).catch(error => { if (root.isConnected) status.textContent = error.message; });
    async function crop(next, trigger) {
      if (!next || state.processing || isSaving()) return;
      state.processing = true;
      status.textContent = '';
      try {
        const photo = await window.VideiraProfile.cropPhoto(next, trigger, source === next ? position : null);
        if (!photo || !root.isConnected) return;
        source = next;
        position = photo.position;
        state.value = photo.value;
        show(photo.value);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        state.processing = false;
        file.value = '';
      }
    }
    file.onchange = () => crop(file.files[0], file);
    adjust.onclick = () => crop(source || (existing && 'data:image/jpeg;base64,' + existing), adjust);
    remove.onclick = () => {
      if (state.processing || isSaving()) return;
      state.value = '';
      source = position = undefined;
      show();
    };
    return state;
  }

  return {bind, field, request};
})();
