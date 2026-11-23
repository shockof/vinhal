'use strict';
(() => {
 const text=(id,selector,group,label,context,long=false)=>{
  const el=document.querySelector(selector);if(!el||CMS_TEXTS.some(f=>f.id===id))return;
  const clone=el.cloneNode(true);clone.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));
  const original=clone.textContent.trim();el.dataset.cmsText=id;
  CMS_TEXTS.push({id,el,selector,group,label,context,long,value:original,original});
 };
 const image=(id,selector,group,label)=>{
  const el=document.querySelector(selector);if(!el||CMS_IMAGES.some(f=>f.id===id))return;
  const original=el.getAttribute('src');el.dataset.cmsImage=id;
  CMS_IMAGES.push({id,el,selector,group,label,value:original,original});
 };
 const link=(id,selector,group,label)=>{
  const el=document.querySelector(selector);if(!el||CMS_LINKS.some(f=>f.id===id))return;
  el.dataset.cmsLink=id;CMS_LINKS.push({id,el,selector,group,label,value:el.getAttribute('href')});
 };
 // Stable identifiers avoid shifting previously published fields.
 text('kids-hero-region','.kids-brand-state','kids','Estado / identificação da rede','Abertura Kids');
 text('kids-hero-eyebrow','.kids-welcome-copy .kids-eyebrow','kids','Chamada curta','Abertura Kids');
 text('kids-hero-title','#kids-welcome-title','kids','Título da abertura','Abertura Kids',true);
 text('kids-hero-intro','.kids-welcome-copy p','kids','Texto junto da turma','Abertura Kids',true);
 text('kids-hero-button','.kids-welcome-button','kids','Texto do botão','Abertura Kids');
 image('kids-hero-brand','.kids-brand-3d','kids','Logo 3D Kids');
 image('kids-hero-group','.kids-turma-3d','kids','Turma Kids (PNG com fundo transparente)');
 link('kids-hero-button-link','.kids-welcome-button','kids','Destino do botão Conheça a Rede Kids');
 image('giving-pix-qr','#givingQr','inicio','QR Code de dízimos e ofertas');
 text('footer-large-wordmark','.footer-wordmark','chrome','Nome em destaque no final do rodapé','Rodapé');
 for(const [id,selector,label,long] of [
  ['audio-public-kicker','#word-audio-kicker','Chamada acima do título',false],
  ['audio-public-title','#word-audio-title','Título Palavra em Áudio',false],
  ['audio-public-intro','#word-audio-intro','Apresentação dos áudios',true],
  ['audio-public-empty','#word-audio-empty','Mensagem quando não há áudio publicado',true]
 ])text(id,selector,'audio',label,'Palavra em Áudio',long);
 // Removed banners remain registered for saved data compatibility, but are no longer offered for editing.
 const retired='#page-kids > .kids-hero,.about-hero,.hero-pills';
 for(const collection of [CMS_TEXTS,CMS_IMAGES,CMS_LINKS,CMS_SECTIONS])for(const field of collection){
  if(field.el?.matches(retired)||field.el?.closest(retired))field.retired=true;
 }
 if(!CMS_TEXTS.some(f=>f.id==='audio-public-empty')){const el=document.createElement('p');const original='Em breve, novas mensagens em áudio estarão disponíveis aqui.';CMS_TEXTS.push({id:'audio-public-empty',el,selector:'#word-audio-empty',group:'audio',label:'Mensagem quando não há áudio publicado',context:'Palavra em Áudio',long:true,value:original,original})}
 const obsolete=CMS_GROUPS.findIndex(([id])=>id==='videos');if(obsolete!==-1)CMS_GROUPS.splice(obsolete,1);
 // These public headings are generated from the channel, not manually edited copies.
 for(const field of CMS_TEXTS)if(field.el?.id==='youtube-featured-title')field.retired=true;
 const originalAudioEditor=cmsAudioEditor;
 cmsAudioEditor=function(){
  const fields=CMS_TEXTS.filter(f=>f.group==='audio');
  const panel='<details class="cms-editor-block" open><summary>Textos da seção no site</summary><div class="cms-page-fields">'+fields.map(f=>'<label>'+esc(f.label)+(f.long?'<textarea data-cms-text="'+f.id+'" maxlength="5000">'+esc(cmsWorking.texts[f.id])+'</textarea>':'<input data-cms-text="'+f.id+'" value="'+esc(cmsWorking.texts[f.id])+'" maxlength="300">')+'</label>').join('')+'</div></details>';
  return originalAudioEditor().replace('<article class="cms-content-form">',panel+'<article class="cms-content-form">');
 };
 const originalPageEditor=cmsPageEditor;
 cmsPageEditor=function(group){
  let html=originalPageEditor(group);
  if(group==='kids')html+='<div class="cms-inline-info"><label><input type="checkbox" data-cms-visible="kids-welcome-public" '+(cmsWorking.sections['kids-welcome-public']!==false?'checked':'')+'> Exibir abertura com a logo e a turma Kids</label><p>Use PNG com fundo transparente para a turma. As fotos e os dados da equipe pastoral e das discipuladoras são atualizados em Contas e liderança.</p></div>';
  return html;
 };
 const previousApply=applyContent;
 applyContent=function(raw){
  previousApply(raw);
  const hero=document.querySelector('.kids-welcome');hero?.classList.toggle('cms-section-hidden',raw?.sections?.['kids-welcome-public']===false);
  const group=document.querySelector('.kids-turma-3d');const overlay=document.querySelector('.kids-eye-tint');
  if(overlay)overlay.style.display=group?.getAttribute('src')==='assets/kids/turma-master-hq.png'?'':'none';
 };
 state.published=cmsNormalize(state.published);if(state.draft)state.draft=cmsNormalize(state.draft);
 if(cmsWorking)cmsWorking=cmsNormalize(cmsWorking);
 publicRefresh();
})();
