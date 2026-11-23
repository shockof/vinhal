'use strict';
(() => {
 const page=document.getElementById('page-kids');
 if(!page||page.querySelector('.kids-welcome'))return;
 const intro=page.querySelector('.kids-hero')?.nextElementSibling;
 if(intro)intro.id='kids-descobertas';
 const hero=document.createElement('section');
 hero.className='kids-welcome';hero.setAttribute('aria-labelledby','kids-welcome-title');
 hero.innerHTML=`<div class="container kids-welcome-inner"><div class="kids-brand-lockup"><img class="kids-brand-3d" src="assets/kids/logo-3d.jpg" width="2172" height="724" alt="Radicais Kids" fetchpriority="high"><span class="kids-brand-state">ALAGOAS</span></div><div class="kids-welcome-grid"><div class="kids-welcome-copy"><span class="kids-eyebrow">Radicais Kids</span><h1 id="kids-welcome-title">Pequenos corações,<br>grandes descobertas.</h1><p>Um lugar para crescer na fé, aprender e viver grandes amizades.</p><a class="kids-welcome-button" href="#kids-descobertas">Conheça a Rede Kids</a></div><div class="kids-turma-art"><div class="kids-orbits" aria-hidden="true"></div><img class="kids-turma-3d" src="assets/kids/turma-master-hq.png" width="1536" height="1024" alt="A turma Radicais Kids em 3D, com seis crianças e duas adultas sobre plataformas coloridas." decoding="async"><svg class="kids-eye-tint" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"><defs><filter id="kids-green-irises" color-interpolation-filters="sRGB"><feColorMatrix type="hueRotate" values="-65"/></filter><clipPath id="kids-iris-regions"><ellipse cx="1266" cy="231" rx="9" ry="13"/><ellipse cx="1316" cy="230" rx="9" ry="13"/></clipPath><clipPath id="kids-shirt-logo-eye"><ellipse cx="1318" cy="374.5" rx="3.5" ry="5.2"/></clipPath><filter id="kids-shirt-silver" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs><image href="assets/kids/turma-master-hq.png" width="1536" height="1024" clip-path="url(#kids-iris-regions)" filter="url(#kids-green-irises)"/><image href="assets/kids/turma-master-hq.png" width="1536" height="1024" clip-path="url(#kids-shirt-logo-eye)" filter="url(#kids-shirt-silver)"/></svg></div></div></div>`;
 const orbits=hero.querySelector('.kids-orbits');
 const dots=[[2,42,10],[7,65,14],[94,12,12],[98,25,16],[87,81,9],[14,15,8],[72,4,10],[99,65,9]];
 dots.forEach(([x,y,size],i)=>{const dot=document.createElement('span');dot.style.cssText=`left:${x}%;top:${y}%;--kids-dot:${size}px;--kids-float:${5+i%4}s;--kids-fade:${3.5+i%3*.8}s;--kids-delay:-${i*.9}s`;orbits.append(dot)});
 document.addEventListener('visibilitychange',()=>hero.classList.toggle('is-paused',document.hidden));
 page.prepend(hero);
 hero.querySelector('a').addEventListener('click',event=>{if(!intro)return;event.preventDefault();intro.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});intro.setAttribute('tabindex','-1');intro.focus({preventScroll:true});});
})();
