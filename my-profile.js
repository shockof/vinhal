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
    <h2 id="photoCropTitle">Mover e redimensionar</h2>
    <div class="photo-crop-stage">
     <canvas width="640" height="640" tabindex="0" aria-label="Enquadramento da foto" aria-describedby="photoCropHelp"></canvas>
    </div>
    <p id="photoCropHelp">Arraste para mover. Use a pinça ou role sobre a foto para ampliar. Pelo teclado, use as setas e as teclas + e −.</p>
    <p class="photo-crop-error" role="alert"></p>
    <div class="actions">
     <button type="button" class="secondary" data-cancel>Cancelar</button>
     <button type="button" data-apply>Escolher</button>
    </div>`;
   const canvas=dialog.querySelector('canvas');
   const ctx=canvas.getContext('2d');
   const center=320;
   const diameter=512;
   const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
   let zoom=Number(previous?.zoom)||1;
   let x=Number(previous?.x) || width/2;
   let y=Number(previous?.y) || height/2;
   const scale=()=>diameter*zoom/Math.min(width,height);
   const draw=()=>{
    const ratio=scale();
    const radius=diameter/2/ratio;
    x=clamp(x,radius,width-radius);
    y=clamp(y,radius,height-radius);
    ctx.fillStyle='#24192e';
    ctx.fillRect(0,0,640,640);
    ctx.fillStyle='#fff';
    ctx.fillRect(center-x*ratio,center-y*ratio,width*ratio,height*ratio);
    ctx.drawImage(image,center-x*ratio,center-y*ratio,width*ratio,height*ratio);
    ctx.fillStyle='rgba(0,0,0,.55)';
    ctx.beginPath();
    ctx.rect(0,0,640,640);
    ctx.arc(center,center,diameter/2,0,2*Math.PI);
    ctx.fill('evenodd');
   };
   const adjust=(nextZoom,from,to=from)=>{
    const ratio=scale();
    const anchorX=x+(from.x-center)/ratio;
    const anchorY=y+(from.y-center)/ratio;
    zoom=clamp(nextZoom,1,4);
    x=anchorX-(to.x-center)/scale();
    y=anchorY-(to.y-center)/scale();
    draw();
   };
   const point=event=>{
    const rect=canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*640/rect.width,y:(event.clientY-rect.top)*640/rect.height};
   };
   const pointers=new Map();
   const gesture=()=>{
    const [first,second]=pointers.values();
    if(!second)return {center:first,distance:0};
    return {center:{x:(first.x+second.x)/2,y:(first.y+second.y)/2},
     distance:Math.hypot(first.x-second.x,first.y-second.y)};
   };
   canvas.onpointerdown=event=>{
    if(event.button!==0||pointers.size>=2)return;
    canvas.focus({preventScroll:true});
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,point(event));
   };
   canvas.onpointermove=event=>{
    if(!pointers.has(event.pointerId))return;
    const before=gesture();
    pointers.set(event.pointerId,point(event));
    const after=gesture();
    const factor=before.distance>0&&after.distance>0?after.distance/before.distance:1;
    adjust(zoom*factor,before.center,after.center);
   };
   const endPointer=event=>pointers.delete(event.pointerId);
   canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=endPointer;
   canvas.addEventListener('wheel',event=>{
    event.preventDefault();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?640:1);
    adjust(zoom*Math.exp(-delta*0.003),point(event));
   },{passive:false});
   canvas.onkeydown=event=>{
    const origin={x:center,y:center};
    const arrows={ArrowLeft:[-14,0],ArrowRight:[14,0],ArrowUp:[0,-14],ArrowDown:[0,14]};
    if(event.key in arrows){
     const [dx,dy]=arrows[event.key];
     adjust(zoom,origin,{x:center+dx,y:center+dy});
    }else if(['+','=','-','−'].includes(event.key)){
     adjust(zoom*(event.key==='-'||event.key==='−'?1/1.12:1.12),origin);
    }else return;
    event.preventDefault();
   };
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
      const output=document.createElement('canvas');
      output.width=output.height=diameter;
      const final=output.getContext('2d');
      const size=diameter/scale();
      final.fillStyle='#fff';
      final.fillRect(0,0,diameter,diameter);
      final.drawImage(image,x-size/2,y-size/2,size,size,0,0,diameter,diameter);
      const value=output.toDataURL('image/jpeg',0.85).split(',')[1];
      if(!value||value.length>700000)throw Error('Escolha uma foto menor.');
      crop={value,position:{zoom,x,y}};
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
