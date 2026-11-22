'use strict';
(() => {
  const header = document.querySelector('body > header');
  const root = document.getElementById('public');
  if (!header || !root) return;
  const expansions = [root.querySelector('#page-inicio .vision')?.closest('section'),root.querySelector('#mensagem')].filter(Boolean);
  expansions.forEach(section=>section.classList.add('scroll-expand'));
  const particles=document.createElement('div');
  particles.className='site-particles';particles.setAttribute('aria-hidden','true');
  for(let i=0;i<40;i++){
    const dot=document.createElement('span');
    const side=i%2===0?2+(i*7%10):89+(i*3%10);
    dot.style.cssText='left:'+side+'%;top:'+(i*37%100)+'%;--drift:'+(6+i%6)+'s;--fade:'+(4+i%5*.65)+'s;--delay:-'+(i*1.7)+'s;--dot:'+(2+i%3)+'px';
    particles.append(dot);
  }
  root.prepend(particles);
  document.addEventListener('visibilitychange',()=>particles.classList.toggle('is-paused',document.hidden));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const footer=document.querySelector('.site-footer');
  if(footer){const mark=document.createElement('div');mark.className='footer-wordmark';mark.textContent='VIDEIRA';mark.setAttribute('aria-hidden','true');footer.querySelector('.container').insertBefore(mark,footer.querySelector('.footer-bottom'));}
  const selector = '.page-section > section:not(.hero) > .container > *, .page-section > .container > *';
  let scheduled = false;
  const updateHeader = () => {
    scheduled = false;
    for(const expansion of expansions) {
      if(!expansion.closest('.page-section')?.classList.contains('active'))continue;
      const rect=expansion.getBoundingClientRect();
      const progress=reduced.matches?1:Math.max(0,Math.min(1,(innerHeight-rect.top)/(innerHeight*.75)));
      expansion.style.setProperty('--section-scale',String(.94+.06*progress));
    }
    const floating=header.classList.contains('is-floating');
    if(window.scrollY>72&&!floating)header.classList.add('is-floating');
    else if(window.scrollY<24&&floating)header.classList.remove('is-floating');
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
    for (const item of [...root.querySelectorAll(selector), ...document.querySelectorAll('.site-footer .footer-grid > *, .site-footer .footer-bottom, .footer-wordmark')]) {
      if (item.classList.contains('scroll-reveal') || item.closest('.hero')) continue;
      item.classList.add('scroll-reveal');
      if (reduced.matches) item.classList.add('scroll-entered');
      else observer.observe(item);
    }
  }
  document.addEventListener('focusin', event => {
    event.target.closest('.scroll-reveal')?.classList.add('scroll-entered');
  });
  reduced.addEventListener('change', () => {
    updateHeader();
    if (!reduced.matches) return;
    observer.disconnect();
    document.querySelectorAll('.scroll-reveal').forEach(item => item.classList.add('scroll-entered'));
  });
  window.addEventListener('videira:navigation', () => {prepare();updateHeader();});
  window.addEventListener('resize',updateHeader,{passive:true});
  let refresh = false;
  new MutationObserver(() => {
    if (refresh) return;
    refresh = true;
    requestAnimationFrame(() => { refresh = false; prepare(); });
  }).observe(root, {childList: true, subtree: true});
  prepare();
})();
