'use strict';
window.VideiraProfile=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function cropPhoto(source,trigger,previous){
  const isFile=source instanceof File;
  if(isFile&&(!['image/jpeg','image/png','image/webp'].includes(source.type)||source.size>8388608))
   throw Error('Escolha uma foto JPG, PNG ou WebP de até 8 MB.');
  const url=isFile?URL.createObjectURL(source):source;
  try{
   const image=await new Promise((resolve,reject)=>{
    const img=new Image();
    if(!isFile&&url.startsWith('https:'))img.crossOrigin='anonymous';
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(Error('Não foi possível abrir esta foto.'));
    img.src=url;
   });
   const {naturalWidth:width,naturalHeight:height}=image;
   if(!width||!height||width>12000||height>12000)throw Error('Escolha uma foto com dimensões menores.');
   if(!trigger.isConnected)return null;

   const dialog=document.createElement('dialog');
   dialog.className='photo-crop-dialog';
   dialog.setAttribute('aria-labelledby','photoCropTitle');
   dialog.innerHTML=`
    <h2 id="photoCropTitle">Ajustar foto de perfil</h2>
    <p>Arraste a foto ou use os controles para ajustar o enquadramento.</p>
    <canvas width="512" height="512" role="img" aria-label="Prévia circular da foto"></canvas>
    <label>Zoom <input name="zoom" type="range" min="1" max="4" step="0.01" value="1"></label>
    <div class="photo-crop-position">
     <label>Horizontal <input name="horizontal" type="range" min="-100" max="100" step="1" value="0"></label>
     <label>Vertical <input name="vertical" type="range" min="-100" max="100" step="1" value="0"></label>
    </div>
    <p class="photo-crop-error" role="alert"></p>
    <div class="actions">
     <button type="button" class="secondary" data-cancel>Cancelar</button>
     <button type="button" data-apply>Usar este recorte</button>
    </div>`;
   const canvas=dialog.querySelector('canvas');
   const ctx=canvas.getContext('2d');
   const zoom=dialog.querySelector('[name=zoom]');
   const horizontal=dialog.querySelector('[name=horizontal]');
   const vertical=dialog.querySelector('[name=vertical]');
   if(previous){
    zoom.value=previous.zoom;
    horizontal.value=previous.horizontal;
    vertical.value=previous.vertical;
   }
   const extent=()=>Math.min(width,height)/Number(zoom.value);
   const draw=()=>{
    const size=extent();
    const x=(width-size)*(1+Number(horizontal.value)/100)/2;
    const y=(height-size)*(1+Number(vertical.value)/100)/2;
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,512,512);
    ctx.drawImage(image,x,y,size,size,0,0,512,512);
   };
   for(const control of [zoom,horizontal,vertical])control.oninput=draw;
   let drag=null;
   canvas.onpointerdown=event=>{
    if(!event.isPrimary||event.button!==0)return;
    canvas.setPointerCapture(event.pointerId);
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,
     horizontal:Number(horizontal.value),vertical:Number(vertical.value)};
   };
   canvas.onpointermove=event=>{
    if(drag?.id!==event.pointerId)return;
    const size=extent();
    const scale=size/canvas.getBoundingClientRect().width;
    const move=(control,start,delta,available)=>{
     if(available>0)control.value=String(Math.max(-100,Math.min(100,start-delta*scale*200/available)));
    };
    move(horizontal,drag.horizontal,event.clientX-drag.x,width-size);
    move(vertical,drag.vertical,event.clientY-drag.y,height-size);
    draw();
   };
   canvas.onlostpointercapture=()=>{drag=null};
   draw();
   document.body.append(dialog);
   return await new Promise(resolve=>{
    let crop=null;
    dialog.addEventListener('close',()=>{
     dialog.remove();
     if(trigger.isConnected)trigger.focus();
     resolve(crop);
    },{once:true});
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('[data-apply]').onclick=()=>{
     try{
      const value=canvas.toDataURL('image/jpeg',0.85).split(',')[1];
      if(!value||value.length>700000)throw Error('Escolha uma foto menor.');
      crop={value,position:{zoom:zoom.value,horizontal:horizontal.value,vertical:vertical.value}};
      dialog.close();
     }catch{
      dialog.querySelector('[role=alert]').textContent='Não foi possível usar este recorte. Tente selecionar a foto novamente.';
     }
    };
    dialog.showModal();
   });
  }finally{if(isFile)URL.revokeObjectURL(url)}
 }
 async function mount(root,{call,onSaved,onPasswordChanged}){
  root.innerHTML='<article class="panel"><p>Carregando seu perfil…</p></article>';
  let data;try{data=await call('profile_get')}catch(e){if(root.isConnected)root.innerHTML='<article class="panel"><p role="alert">'+esc(e.message)+'</p></article>';return}if(!root.isConnected)return;
  let image=null,remove=false,processing=false,saving=false,photoVersion=0;const avatar=()=>data.photo_url?`<img src="${esc(data.photo_url)}" alt="Sua foto de perfil">`:'<span aria-label="Sem foto">'+esc((data.display_name||'?').slice(0,1).toUpperCase())+'</span>';
  root.innerHTML=`<article class="panel"><h2>Meus dados</h2><form id="myProfileForm" class="gridform"><div class="profile-photo-row wide"><div class="profile-avatar" id="myPhotoPreview">${avatar()}</div><div><label>Foto de perfil<input id="myPhotoFile" type="file" accept="image/jpeg,image/png,image/webp"></label><small>JPG, PNG ou WebP · até 8 MB</small><div class="actions"><button type="button" class="secondary" id="cropMyPhoto" ${data.photo_url?'':'hidden'}>Ajustar enquadramento</button><button type="button" class="secondary" id="removeMyPhoto">Remover foto</button></div></div></div><label>Nome completo<input name="display_name" value="${esc(data.display_name)}" required maxlength="180" autocomplete="name"></label><label>Nome de usuário<input value="${esc(data.username)}" readonly aria-readonly="true"></label><label>Data de nascimento (opcional)<input name="birth_date" type="date" value="${esc(data.birth_date)}" autocomplete="bday"></label><label>Telefone<input name="phone" type="tel" value="${esc(data.phone)}" maxlength="40" autocomplete="tel"></label><label>E-mail de contato (opcional)<input name="contact_email" type="email" value="${esc(data.contact_email)}" maxlength="254" autocomplete="email"></label><p class="notice wide">Seu login continua pelo nome de usuário. Este e-mail é de contato. A foto e os dados de contato ficam no cadastro interno.</p><div class="actions wide"><button>Salvar meu perfil</button></div></form><p id="myProfileFeedback" role="status" aria-live="polite"></p></article><article class="panel"><h2>Alterar minha senha</h2><form id="myPasswordForm" class="gridform"><label class="wide">Senha atual<input name="current_password" type="password" required maxlength="1024" autocomplete="current-password"></label><label>Nova senha<input name="new_password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><label>Confirme a nova senha<input name="confirm_password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><p class="notice wide">Use uma nova senha com pelo menos 12 caracteres. Depois da alteração, entre novamente.</p><div class="actions wide"><button>Alterar senha</button></div></form><p id="myPasswordFeedback" role="status" aria-live="polite"></p></article>`;
  const form=root.querySelector('#myProfileForm'),file=root.querySelector('#myPhotoFile'),preview=root.querySelector('#myPhotoPreview'),feedback=root.querySelector('#myProfileFeedback');
  const adjust=root.querySelector('#cropMyPhoto');
  let photoSource=null,position=null;
  const editPhoto=async(source,trigger)=>{
   if(processing||saving)return;
   const version=++photoVersion;
   processing=true;
   feedback.textContent='';
   try{
    const prepared=await cropPhoto(source,trigger,source===photoSource?position:null);
    if(!prepared||version!==photoVersion||!root.isConnected)return;
    photoSource=source;
    position=prepared.position;
    image=prepared.value;
    remove=false;
    adjust.hidden=false;
    preview.innerHTML='<img src="data:image/jpeg;base64,'+image+'" alt="Prévia da nova foto">';
    feedback.textContent='Clique em Salvar meu perfil para confirmar.';
   }catch(error){
    if(version===photoVersion)feedback.textContent=error.message;
   }finally{
    if(version===photoVersion){processing=false;file.value=''}
   }
  };
  file.onchange=()=>{if(file.files[0])editPhoto(file.files[0],file)};
  adjust.onclick=()=>editPhoto(photoSource||data.photo_url,adjust);
  root.querySelector('#removeMyPhoto').onclick=()=>{
   photoVersion++;processing=false;image=null;photoSource=null;position=null;remove=true;file.value='';
   adjust.hidden=true;preview.innerHTML='<span>—</span>';
   feedback.textContent='A foto será removida ao salvar o perfil.';
  };
  form.onsubmit=async e=>{e.preventDefault();if(processing)return feedback.textContent='Aguarde a preparação da foto.';if(saving)return;saving=true;form.querySelector('button[type="submit"],button:not([type])').disabled=true;feedback.textContent='Salvando seu perfil…';try{const payload=Object.fromEntries(new FormData(form));if(image)payload.photo_base64=image;if(remove)payload.remove_photo=true;const result=await call('profile_save',payload);await onSaved(result)}catch(error){feedback.textContent=error.message;form.querySelector('button[type="submit"],button:not([type])').disabled=false}finally{saving=false}};
  const passwords=root.querySelector('#myPasswordForm'),passwordFeedback=root.querySelector('#myPasswordFeedback');let changing=false;
  passwords.onsubmit=async e=>{e.preventDefault();if(changing)return;const d=Object.fromEntries(new FormData(passwords));if(d.new_password!==d.confirm_password)return passwordFeedback.textContent='As novas senhas não coincidem.';if(d.current_password===d.new_password)return passwordFeedback.textContent='Escolha uma senha diferente da atual.';changing=true;passwords.querySelector('button').disabled=true;passwordFeedback.textContent='Alterando sua senha…';try{await call('change_password',{current_password:d.current_password,new_password:d.new_password});passwords.reset();onPasswordChanged()}catch(error){passwordFeedback.textContent=error.message;passwords.reset();passwords.querySelector('button').disabled=false}finally{d.current_password=d.new_password=d.confirm_password='';changing=false}};
 }
 return {mount,cropPhoto};
})();
