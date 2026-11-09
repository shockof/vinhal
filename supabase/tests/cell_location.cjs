// No actual geolocation or network. Test the shipped location controller.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Input extends EventTarget{constructor(value=''){super();this.value=value;this.disabled=false}input(value){this.value=value;this.dispatchEvent(new Event('input'))}}
let fetched=[],mode='normal',geoMode='ok',release;
const navigator={geolocation:{getCurrentPosition(ok,fail){if(geoMode==='denied')fail({code:1});else ok({coords:{latitude:-9.65,longitude:-35.7,accuracy:15}})}}};
const fetch=async(url)=>{fetched.push(url);if(mode==='delayed')await new Promise(r=>release=r);if(mode==='fail')throw Error('offline');const cep=url.includes('viacep')?url.split('/')[4]:url.split('/').pop();return new Response(JSON.stringify({cep,city:'São Paulo',state:'SP',street:'Praça da Sé',neighborhood:'Sé',location:{coordinates:mode==='missing'?{}:{latitude:'-23.5505',longitude:'-46.6333'}}}),{status:200})};
const context={window:{},navigator,fetch,AbortController,Event,EventTarget,Response,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8'),context);const L=context.window.VideiraLocation;
function make(){const elements=Object.fromEntries(['postal_code','street','house_number','complement','neighborhood','city','state','latitude','longitude'].map(k=>[k,new Input()]));const feedback={textContent:'',classList:{toggle(){}}},maps={hidden:true,href:'',removeAttribute(){this.href=''}},device={disabled:false};const form={elements,isConnected:true,querySelector:s=>({'#cellLocationStatus':feedback,'#cellLocationMaps':maps,'#useDeviceLocation':device,'#lookupCellCep':{}}[s])};return {elements,feedback,maps,device,control:L.bind(form,{})}}
(async()=>{
 assert(!L.valid('',0));assert(!L.valid(NaN,0));assert(!L.valid(91,0));assert(L.valid(-9,-35));
 const a=make();a.elements.postal_code.input('01001000');a.elements.postal_code.dispatchEvent(new Event('blur'));await a.control.wait();assert.equal(a.elements.postal_code.value,'01001-000');assert.equal(a.elements.street.value,'Praça da Sé');assert.equal(a.elements.latitude.value,-23.5505);assert.equal(a.control.read().address_details.source,'cep');assert(a.feedback.textContent.includes('aproximada'));
 a.elements.house_number.value='123';assert(a.control.read().private_address.includes('123'));
 a.device.onclick();await a.control.wait();assert.equal(a.control.read().address_details.source,'device');assert.equal(a.control.read().address_details.accuracy_m,15);
 a.elements.postal_code.input('01002000');a.elements.postal_code.dispatchEvent(new Event('blur'));await a.control.wait();assert.equal(a.elements.latitude.value,'-9.6500000');assert.equal(a.control.read().address_details.source,'device');
 geoMode='denied';a.device.onclick();await a.control.wait();assert(a.feedback.textContent.includes('negada'));geoMode='ok';
 const b=make();mode='missing';b.elements.postal_code.input('01003000');b.elements.postal_code.dispatchEvent(new Event('blur'));await b.control.wait();assert.equal(b.elements.latitude.value,'');assert(b.feedback.textContent.includes('não forneceu coordenadas'));
 const c=make();mode='delayed';c.elements.postal_code.input('01004000');c.elements.postal_code.dispatchEvent(new Event('blur'));const old=c.control.wait();c.device.onclick();await c.control.wait();mode='normal';release();await old;assert.equal(c.control.read().address_details.source,'device');assert.equal(c.elements.latitude.value,'-9.6500000');
 assert(fetched.every(url=>/^https:\/\/(brasilapi.com.br\/api\/cep\/v2\/\d{8}|viacep.com.br\/ws\/\d{8}\/json\/)$/ .test(url)));assert(!fetched.join(' ').includes('-9.65'));
 console.log('PASS CEP autofill, approximate coordinates, GPS precision/denial, GPS preservation, missing coordinates, stale-response race and no device coordinates in lookup requests');
})().catch(e=>{console.error(e);process.exit(1)});
