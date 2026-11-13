'use strict';
(()=>{for(const name of ['sessionStorage','localStorage']){try{const s=JSON.parse(window[name].getItem('videira:gestao:session:v1'));if(s?.access_token&&s?.refresh_token&&!new URLSearchParams(location.search).has('senha')){document.documentElement.classList.add('restoring-management');break}}catch{}}})();
