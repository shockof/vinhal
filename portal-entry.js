'use strict';
// Production access and the sample dashboard remain separate.
document.querySelector('#loginBtn').onclick=()=>{location.href='gestao.html'};
const demoButton=document.createElement('button');demoButton.type='button';demoButton.className='dash-button';demoButton.textContent='Explorar demonstração';demoButton.onclick=()=>openLogin();document.querySelector('footer .toolbar').append(demoButton);
