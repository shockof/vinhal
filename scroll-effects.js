'use strict';
(() => {
  const header = document.querySelector('body > header');
  const root = document.getElementById('public');
  if (!header || !root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const selector = '.page-section > section:not(.hero) > .container > *, .page-section > .container > *';
  let scheduled = false;
  const updateHeader = () => {
    scheduled = false;
    header.classList.toggle('is-floating', window.scrollY > 48);
  };
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateHeader); }
  }, {passive: true});
  updateHeader();
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('scroll-entered');
      observer.unobserve(entry.target);
    }
  }, {threshold: 0, rootMargin: '0px 0px -36px 0px'});
  function prepare() {
    for (const item of root.querySelectorAll(selector)) {
      if (item.classList.contains('scroll-reveal') || item.closest('.hero')) continue;
      item.classList.add('scroll-reveal');
      if (reduced.matches) item.classList.add('scroll-entered');
      else observer.observe(item);
    }
  }
  root.addEventListener('focusin', event => {
    event.target.closest('.scroll-reveal')?.classList.add('scroll-entered');
  });
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    observer.disconnect();
    root.querySelectorAll('.scroll-reveal').forEach(item => item.classList.add('scroll-entered'));
  });
  window.addEventListener('videira:navigation', prepare);
  let refresh = false;
  new MutationObserver(() => {
    if (refresh) return;
    refresh = true;
    requestAnimationFrame(() => { refresh = false; prepare(); });
  }).observe(root, {childList: true, subtree: true});
  prepare();
})();
