'use strict';
(()=>{
 const hero=document.querySelector('#page-inicio > .hero');
 if(!hero)return;
 const cover=document.createElement('div');cover.className='banner-white-cover';cover.setAttribute('aria-hidden','true');hero.append(cover);
 let pending=false;
 function paint(){pending=false;cover.style.setProperty('--cover-release',Math.min(64,Math.max(0,scrollY*.45))+'px');}
 addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(paint)}},{passive:true});addEventListener('videira:navigation',paint);paint();
})();
