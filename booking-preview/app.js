import {OPEN,CLOSE,DAY,beijingDate,addDays,toMinutes,timeText,durationText,validateRange,demoBusy} from './model.js';
const $ = id => document.getElementById(id);
const state = {date:addDays(beijingDate(),2),start:OPEN,end:OPEN+60,scenario:'normal',bookings:[],lastBooking:null};
let month = state.date.slice(0,7), drag = null;
const dateLong = date => new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Shanghai'}).format(new Date(date+'T12:00:00+08:00'));
const blocks = () => [...demoBusy(state.date,state.scenario),...state.bookings.filter(b=>b.date===state.date)];
const validity = () => validateRange({...state,busy:blocks()});
function renderCalendar() {
  const [year,m] = month.split('-').map(Number);
  $('month-title').textContent = `${year} 年 ${m} 月`;
  const first = new Date(Date.UTC(year,m-1,1));
  const offset = (first.getUTCDay()+6)%7;
  const days = new Date(Date.UTC(year,m,0)).getUTCDate();
  $('calendar').replaceChildren();
  const today = beijingDate(), last = addDays(today,30);
  for(let i=0;i<offset;i++) { const blank=document.createElement('span');blank.className='calendar-blank';$('calendar').append(blank); }
  for(let d=1;d<=days;d++) {
    const date=`${month}-${String(d).padStart(2,'0')}`;
    const button=document.createElement('button');button.type='button';button.textContent=d;
    button.disabled=date<=today || date>last;
    button.setAttribute('aria-label',`${dateLong(date)}${date===state.date?'，已选':''}`);
    button.setAttribute('aria-pressed',String(date===state.date));
    if(date===state.date) button.classList.add('selected');
    button.addEventListener('click',()=>{state.date=date;render();});
    $('calendar').append(button);
  }
  $('prev-month').disabled=month<=today.slice(0,7);
  $('next-month').disabled=month>=last.slice(0,7);
}
function renderBusy() {
  $('busy-blocks').replaceChildren();
  for(const b of blocks()) {
    const element=document.createElement('div');element.className=`busy-block${b.id?' demo-booking':''}`;
    element.style.top=`${(b.start-OPEN)/(CLOSE-OPEN)*100}%`;element.style.height=`${(b.end-b.start)/(CLOSE-OPEN)*100}%`;
    const label=document.createElement('strong');label.textContent=b.id?'演示预约':'忙碌';
    const time=document.createElement('span');time.textContent=`${timeText(b.start)}–${timeText(b.end)}`;
    element.append(label,time);$('busy-blocks').append(element);
  }
}
function renderRange(syncInputs=true) {
  const valid=validity(), selection=$('selection');
  const usable=Number.isFinite(state.start)&&Number.isFinite(state.end)&&state.end>state.start&&state.start>=OPEN&&state.end<=CLOSE;
  selection.hidden=!usable||state.scenario==='error';
  if(usable) {selection.style.top=`${(state.start-OPEN)/(CLOSE-OPEN)*100}%`;selection.style.height=`${(state.end-state.start)/(CLOSE-OPEN)*100}%`;}
  selection.classList.toggle('conflict',!valid.ok);
  selection.classList.toggle('compact',state.end-state.start<40);
  $('range-label').textContent=`${timeText(state.start)}–${timeText(state.end)}`;
  $('range-duration').textContent=durationText(state.end-state.start);
  $('duration-summary').textContent=durationText(state.end-state.start);
  $('availability-status').textContent=valid.message;
  $('availability-status').classList.toggle('invalid',!valid.ok);
  $('continue').disabled=!valid.ok;
  $('timeline-unavailable').hidden=state.scenario!=='error';
  if(syncInputs) {$('start-time').value=timeText(state.start);$('end-time').value=timeText(state.end);}
}
function render() {
  renderCalendar();renderBusy();renderRange();
  $('selected-date').textContent=dateLong(state.date);$('summary-date').textContent=dateLong(state.date);
  document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===state.scenario)));
}
for(const direction of ['prev','next']) $(direction+'-month').addEventListener('click',()=>{
  const [year,m]=month.split('-').map(Number);month=new Date(Date.UTC(year,m-1+(direction==='next'?1:-1),1)).toISOString().slice(0,7);renderCalendar();
});
for(const type of ['start','end']) $(type+'-time').addEventListener('input',()=>{state[type]=toMinutes($(type+'-time').value);renderRange(false);});
const timeline=$('timeline');
function pointerMinute(event) {const bounds=timeline.getBoundingClientRect();return Math.max(OPEN,Math.min(CLOSE,OPEN+Math.round((event.clientY-bounds.top)/bounds.height*(CLOSE-OPEN)/15)*15));}
timeline.addEventListener('pointerdown',event=>{
  if(event.button!==0||state.scenario==='error') return;
  const handle=event.target.closest('[data-handle]')?.dataset.handle;
  const anchor=pointerMinute(event);
  drag={pointer:event.pointerId,handle,anchor,before:{start:state.start,end:state.end}};
  timeline.setPointerCapture(event.pointerId);event.preventDefault();
  if(!handle) {state.start=Math.min(anchor,CLOSE-15);state.end=state.start+15;}
  renderRange();
});
timeline.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointer) return;
  const minute=pointerMinute(event);
  if(drag.handle==='start') state.start=Math.min(minute,state.end-1);
  else if(drag.handle==='end') state.end=Math.max(minute,state.start+1);
  else {state.start=Math.min(drag.anchor,minute);state.end=Math.max(drag.anchor,minute);if(state.start===state.end){state.start=Math.min(state.start,CLOSE-15);state.end=state.start+15;}}
  renderRange();
});
timeline.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.pointer){drag=null;timeline.releasePointerCapture(event.pointerId);}});
timeline.addEventListener('pointercancel',()=>{if(drag){Object.assign(state,drag.before);drag=null;renderRange();}});
document.querySelectorAll('[data-handle]').forEach(handle=>handle.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();const amount=['ArrowUp','ArrowLeft'].includes(event.key)?-15:15;
  if(handle.dataset.handle==='start')state.start=Math.max(OPEN,Math.min(state.end-1,state.start+amount));
  else state.end=Math.min(CLOSE,Math.max(state.start+1,state.end+amount));renderRange();
}));
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>{state.scenario=button.dataset.scenario;render();}));
$('reset').addEventListener('click',()=>{Object.assign(state,{date:addDays(beijingDate(),2),start:OPEN,end:OPEN+60,scenario:'normal',bookings:[],lastBooking:null});month=state.date.slice(0,7);$('booking-form').reset();render();});
function recap() {return `${dateLong(state.date)}\n${timeText(state.start)}–${timeText(state.end)} · ${durationText(state.end-state.start)}\n北京时间 UTC+8`;}
$('continue').addEventListener('click',()=>{
  if(!validity().ok) {renderRange();return;}
  $('form-recap').textContent=recap();$('contact-step').hidden=false;$('success-step').hidden=true;$('form-error').hidden=true;
  $('booking-dialog').showModal();$('guest-name').focus();
});
$('close-dialog').addEventListener('click',()=>$('booking-dialog').close());
$('booking-form').addEventListener('submit',event=>{
  event.preventDefault();const valid=validity();
  if(!valid.ok){$('form-error').textContent=valid.message;$('form-error').hidden=false;return;}
  if(!$('guest-name').value.trim()){$('form-error').textContent='请填写称呼。';$('form-error').hidden=false;return;}
  const booking={id:crypto.randomUUID(),date:state.date,start:state.start,end:state.end};
  state.bookings.push(booking);state.lastBooking=booking.id;
  $('success-recap').textContent=recap();$('contact-step').hidden=true;$('success-step').hidden=false;
  $('booking-dialog').setAttribute('aria-labelledby','success-title');render();$('success-title').focus();
});
$('back-to-calendar').addEventListener('click',()=>$('booking-dialog').close());
$('cancel-demo').addEventListener('click',()=>{state.bookings=state.bookings.filter(b=>b.id!==state.lastBooking);state.lastBooking=null;$('booking-form').reset();$('booking-dialog').close();render();});
$('booking-dialog').addEventListener('close',()=>{$('booking-dialog').setAttribute('aria-labelledby','dialog-title');});
render();
