'use strict';
(()=>{
const days=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function parse(value=''){
 const text=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const found=[...text.matchAll(/\b(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)\b/g)];
 const day=found.length===1?['domingo','segunda','terca','quarta','quinta','sexta','sabado'].indexOf(found[0][1].split('-')[0]):null;
 const time=text.match(/\b([01]?\d|2[0-3])\s*[:h]\s*([0-5]\d)?\b/);
 return {day:day===null?null:day,time:time?time[1].padStart(2,'0')+':'+(time[2]||'00'):''};
}
function fields(item={}){const p=parse(item.meeting_schedule),legacy=Boolean(item.id&&item.meeting_schedule);return `<fieldset class="weekly-schedule wide"><legend>Encontro semanal</legend><div class="gridform"><label>Dia da semana<select name="meeting_weekday" ${legacy?'':'required'}><option value="">${legacy?'Manter horário atual':'Selecione o dia'}</option>${days.map((d,i)=>`<option value="${i}" ${p.day===i?'selected':''}>${d}</option>`).join('')}</select></label><label>Horário<input type="time" name="meeting_time" value="${p.time}" ${legacy?'':'required'}></label></div>${legacy?`<p class="location-help">Horário atual: ${esc(item.meeting_schedule)}. Para alterar, escolha o dia e o horário acima.</p>`:''}</fieldset>`}
function read(data,previous=''){const day=data.meeting_weekday,time=data.meeting_time;delete data.meeting_weekday;delete data.meeting_time;const old=parse(previous);if(previous&&day===(old.day===null?'':String(old.day))&&time===old.time)return previous;if(!/^[0-6]$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Escolha o dia da semana e o horário do encontro.');return days[Number(day)]+', '+time}
function today(){return new Date().toLocaleDateString('en-CA',{timeZone:'America/Maceio'})}
function add(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function suggest(schedule,meetings,now=today()){
 const p=parse(schedule),last=meetings.map(m=>m.meeting_date).sort().at(-1)||'';const min=last?add(last,1):'';
 if(p.day===null)return {date:'',min,max:now,message:'Escolha a data deste encontro. Para sugeri-la automaticamente, defina o dia da semana no cadastro da célula.'};
 const weekday=new Date(now+'T12:00:00Z').getUTCDay(),date=add(now,-((weekday-p.day+7)%7));
 if(last&&date<=last)return {date:'',min,max:now,message:'O encontro semanal mais recente já foi registrado. O próximo encontro previsto é '+add(date,7).split('-').reverse().join('/')+'. Se houve um encontro extra, informe uma data posterior à última chamada, até hoje.'};
 return {date,min,max:now,message:'Data sugerida pelo dia semanal da célula: '+date.split('-').reverse().join('/')+'. Confira antes de salvar; você pode ajustar em caso de remarcação.'};
}
window.VideiraWeekly={parse,fields,read,suggest,today};
})();
