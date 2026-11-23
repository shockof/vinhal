'use strict';
async function optimizeSiteImage(file) {
 if (file.type === 'image/webp') return file;
 const url = URL.createObjectURL(file);
 try {
  const image = new Image();
  image.src = url;
  await image.decode();
  const scale = Math.min(1, 1920 / Math.max(image.naturalWidth,image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1,Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1,Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const converted = await new Promise(resolve => canvas.toBlob(resolve,'image/webp',0.86));
  if (converted?.type !== 'image/webp' || !converted.size) throw Error('A conversão para WebP não está disponível neste navegador. Envie uma imagem WebP.');
  return new File([converted],(file.name || 'Imagem').replace(/\.[^.]+$/,'')+'.webp',{type:converted.type});
 } finally {
  URL.revokeObjectURL(url);
 }
}
window.VideiraSiteEditor={mount(root,{call,profile,config,getSession}){
 root.innerHTML='<div class="notice">Edite por seção, salve o rascunho e confira a prévia antes de publicar. Arquivos enviados à biblioteca recebem links públicos. A publicação altera o site para todos os visitantes.</div><iframe class="site-editor-frame" title="Editor do site Videira" src="index.html?editor=1&amp;versao=20261123-editor-complete"></iframe>';
 const frame=root.querySelector('iframe'),allowed=['site_editor_load','site_editor_save','site_editor_publish','site_editor_discard'];
 const listener=async event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.channel!=='videira-site-editor')return;const {id,action,data}=event.data;let result,error;
 try{if(allowed.includes(action))result=await call(action,data);else if(action==='upload'){
  const file=data.file,types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','video/ogg':'ogg','application/pdf':'pdf','text/plain':'txt','application/msword':'doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','application/vnd.ms-powerpoint':'ppt','application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx','application/vnd.ms-excel':'xls','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx','audio/mpeg':'mp3'};
  const isMp3=data.kind==='word'&&(file?.type==='audio/mpeg'||/\.mp3$/i.test(file?.name||''));
  const limitMb=isMp3?50:data.kind==='image'?5:data.kind==='word'?20:50;
  if(!(file instanceof Blob)||!file.size||(!types[file.type]&&!isMp3))throw Error('Escolha um arquivo de imagem, vídeo, documento ou MP3 aceito.');
  if(file.size>limitMb*1048576)throw Error('O limite para este arquivo é '+limitMb+' MB.');
  const upload=data.kind==='image'?await optimizeSiteImage(file):isMp3&&file.type!=='audio/mpeg'?new File([file],file.name,{type:'audio/mpeg'}):file;
  const path=profile.organization_id+'/'+crypto.randomUUID()+'.'+types[upload.type],response=await fetch(config.url+'/storage/v1/object/videira-site-media/'+path,{method:'POST',headers:{apikey:config.publicKey,Authorization:'Bearer '+getSession().access_token,'Content-Type':upload.type,'x-upsert':'false',...(data.kind==='image'?{'cache-control':'31536000'}:{})},body:upload});if(!response.ok)throw Error('Não foi possível carregar o arquivo. Confira o tamanho e tente novamente.');result={url:config.url+'/storage/v1/object/public/videira-site-media/'+path,name:upload.name||'Arquivo',type:upload.type,size:upload.size};
 }else throw Error('Operação inválida');}catch(e){error=e.message}frame.contentWindow.postMessage({channel:'videira-site-editor-reply',id,result,error},location.origin);
 };window.addEventListener('message',listener);const observer=new MutationObserver(()=>{if(!root.isConnected){window.removeEventListener('message',listener);observer.disconnect()}});observer.observe(document.body,{subtree:true,childList:true});
}};
