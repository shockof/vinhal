'use strict';
(() => {
  const validId = /^[A-Za-z0-9_-]{11}$/;
  const get = id => document.getElementById(id);
  const feature = get('videoBtn');
  const host = get('youtube-playlist');
  const thumbnails = get('youtube-thumbnails');
  const more = get('youtube-more');
  const heading = get('youtube-current-title');
  const imageUrl = id => 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
  let catalog = [{id: 'q_vPN6BDvqw', title: get('youtube-featured-title').textContent}];
  let selected = catalog[0];
  let files = [];
  let limit = 12;

  let drag = null;
  let dragged = false;
  thumbnails.addEventListener('pointerdown', event => {
    dragged = false;
    if (event.pointerType !== 'mouse' || event.button !== 0 ||
        thumbnails.scrollWidth <= thumbnails.clientWidth) return;
    drag = {id: event.pointerId, x: event.clientX, left: thumbnails.scrollLeft};
  });
  window.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    if (!dragged && Math.abs(distance) < 6) return;
    if (!dragged) {
      dragged = true;
      thumbnails.classList.add('is-dragging');
      thumbnails.setPointerCapture(event.pointerId);
    }
    thumbnails.scrollLeft = drag.left - distance;
  });
  function finishDrag(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    thumbnails.classList.remove('is-dragging');
  }
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);
  thumbnails.addEventListener('click', event => {
    if (!dragged || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dragged = false;
  }, true);

  function player(video, autoplay) {
    const frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + video.id + '?playsinline=1' + (autoplay ? '&autoplay=1' : '');
    frame.title = video.title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  }

  function renderFiles() {
    const linked = files.filter(file => {
      const source = cmsVideoLink(file.youtubeVideo);
      return file.active !== false && source?.kind === 'youtube' && source.embed.split('/').pop() === selected.id;
    });
    const target = get('youtube-current-files');
    target.replaceChildren();
    if (!linked.length) target.textContent = 'Nenhum arquivo vinculado a este vídeo.';
    for (const file of linked) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dash-button';
      button.textContent = file.title;
      button.onclick = () => cmsDownloadWord(file);
      target.append(button);
    }
  }

  function renderThumbnails() {
    const others = catalog.filter(video => video.id !== selected.id);
    const left = thumbnails.scrollLeft;
    thumbnails.replaceChildren();
    for (const video of others.slice(0, limit)) {
      const button = document.createElement('button');
      const image = document.createElement('img');
      image.src = imageUrl(video.id);
      image.loading = 'lazy';
      image.alt = '';
      const title = document.createElement('span');
      title.textContent = video.title;
      button.type = 'button';
      button.append(image, title);
      button.onclick = () => {
        select(video, true);
        heading.focus({preventScroll: true});
        host.scrollIntoView({block: 'start'});
      };
      thumbnails.append(button);
    }
    thumbnails.scrollLeft = left;
    more.hidden = others.length <= limit;
  }

  function select(video, autoplay = false) {
    selected = video;
    host.replaceChildren(player(video, autoplay));
    heading.textContent = video.title;
    get('youtube-current-description').textContent = video.description || '';
    renderFiles();
    renderThumbnails();
  }

  function openPlaylist() {
    if (!get('page-inicio').classList.contains('active') && featuredPlayer.firstElementChild) {
      featuredPlayer.replaceChildren();
      featuredPlayer.hidden = true;
      feature.hidden = false;
    }
    if (location.hash === '#arquivos') {
      if (!host.firstElementChild) select(selected);
    } else {
      host.replaceChildren();
    }
  }

  more.onclick = () => { limit += 12; renderThumbnails(); };
  const featuredPlayer = get('youtube-featured-player');
  feature.onclick = () => {
    featuredPlayer.replaceChildren(player(catalog[0], true));
    feature.hidden = true;
    featuredPlayer.hidden = false;
  };

  window.addEventListener('videira:navigation', openPlaylist);
  function renderFeatured() {
    const latest = catalog[0];
    feature.querySelector('img').src = imageUrl(latest.id);
    get('youtube-featured-title').textContent = latest.title;
    const description = get('youtube-featured-description');
    description.textContent = latest.description || '';
    description.hidden = !description.textContent;
  }
  window.VideiraYouTube = {setFiles(value) { files = value; renderFiles(); renderFeatured(); }};
  window.VideiraYouTube.setFiles(cmsNormalize(preview && state.draft ? state.draft : state.published).wordFiles);
  openPlaylist();

  async function loadCatalog() {
    for (const url of ['https://raw.githubusercontent.com/shockof/vinhal/main/youtube-catalog.json', 'youtube-catalog.json']) {
      try {
        const response = await fetch(url, {credentials: 'omit', signal: AbortSignal.timeout(5000)});
        if (!response.ok) continue;
        const data = await response.json();
        if (!Array.isArray(data)) continue;
        const items = data.filter(video => validId.test(video?.id) && typeof video.title === 'string');
        if (items.length) return items;
      } catch { /* Use the published catalog if the latest copy is unavailable. */ }
    }
    return catalog;
  }

  loadCatalog().then(items => {
    catalog = items;
    renderFeatured();
    const latest = catalog[0];
    const current = catalog.find(video => video.id === selected.id);
    if (host.firstElementChild && current) {
      selected = current;
      heading.textContent = current.title;
      get('youtube-current-description').textContent = current.description || '';
      renderThumbnails();
    } else if (host.firstElementChild) {
      select(latest);
    } else {
      selected = latest;
      openPlaylist();
    }
  });
})();
