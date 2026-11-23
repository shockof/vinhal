'use strict';
(() => {
 const page=document.getElementById('page-kids');
 if(!page||page.querySelector('.kids-welcome'))return;
 const intro=page.querySelector('.kids-hero')?.nextElementSibling;
 if(intro)intro.id='kids-descobertas';
 const hero=document.createElement('section');
 hero.className='kids-welcome';hero.setAttribute('aria-labelledby','kids-welcome-title');
 hero.innerHTML=`<div class="container kids-welcome-inner"><div class="kids-brand-lockup"><img class="kids-brand-3d" src="assets/kids/logo-3d.jpg" width="2172" height="724" alt="Radicais Kids" fetchpriority="high"><span class="kids-brand-state">ALAGOAS</span></div><div class="kids-welcome-grid"><div class="kids-welcome-copy"><span class="kids-eyebrow">Radicais Kids</span><h1 id="kids-welcome-title">Pequenos corações,<br>grandes descobertas.</h1><p>Um lugar para crescer na fé, aprender e viver grandes amizades.</p><a class="kids-welcome-button" href="#kids-descobertas">Conheça a Rede Kids</a></div><img class="kids-turma-3d" src="assets/kids/turma-3d-oito.jpg" width="1536" height="1024" alt="A turma Radicais Kids em 3D, com seis crianças e duas adultas sobre plataformas coloridas." decoding="async"></div></div>`;
 page.prepend(hero);
 hero.querySelector('a').addEventListener('click',event=>{if(!intro)return;event.preventDefault();intro.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});intro.setAttribute('tabindex','-1');intro.focus({preventScroll:true});});
})();
