'use strict';
(() => {
  const playlist = 'UUeK9EVzNsmiD2PLTMIe_t_w';
  const validId = /^[\w-]{11}$/;
  const feature = document.getElementById('videoBtn');
  const host = document.getElementById('youtube-playlist');
  let video = {id: 'q_vPN6BDvqw', title: document.getElementById('youtube-featured-title').textContent};

  function player(id, autoplay = false) {
    const frame = document.createElement('iframe');
    const url = new URL(id ? '/embed/' + id : '/embed/videoseries', 'https://www.youtube-nocookie.com');
    url.searchParams.set('list', playlist);
    url.searchParams.set('playsinline', '1');
    if (autoplay) url.searchParams.set('autoplay', '1');
    frame.src = url.href;
    frame.title = 'Playlist da Igreja Videira Maceió';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  }

  function openPlaylist() {
    if (location.hash === '#arquivos' && !host.firstElementChild) host.append(player());
  }

  feature.setAttribute('aria-label', 'Assistir à mensagem em destaque');
  feature.onclick = () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'youtube-dialog';
    const close = document.createElement('button');
    close.textContent = 'Fechar vídeo';
    close.className = 'dash-button';
    close.onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove(), {once: true});
    dialog.append(close, player(video.id, true));
    document.body.append(dialog);
    dialog.showModal();
  };
  document.addEventListener('click', event => {
    if (event.target.closest('a[href="#arquivos"]') && !host.firstElementChild) host.append(player());
  });
  window.addEventListener('hashchange', openPlaylist);
  openPlaylist();

  fetch('https://raw.githubusercontent.com/shockof/vinhal/main/youtube-featured.json', {credentials: 'omit'}).then(response => response.ok ? response.json() : null).then(data => {
    if (!data || !validId.test(data.id) || typeof data.title !== 'string') return;
    video = data;
    const image = feature.querySelector('img');
    image.src = 'https://i.ytimg.com/vi/' + video.id + '/hqdefault.jpg';
    document.getElementById('youtube-featured-title').textContent = video.title;
    const description = document.getElementById('youtube-featured-description');
    description.textContent = typeof video.description === 'string' ? video.description : '';
    description.hidden = !description.textContent;
  }).catch(() => {});
})();
