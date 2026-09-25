import {OPEN,closingMinute,DAY,beijingDate,addDays,toMinutes,timeText,durationText,validateRange} from './model.js';
import {live,currentTime,initialize,readDay,mountChallenge,submit,openExisting,retryingRequest} from './live.js';
const $ = id => document.getElementById(id);
const state = {date:addDays(beijingDate(),2),start:OPEN,end:OPEN+60};
let CLOSE=closingMinute(state.date);
let month = state.date.slice(0,7), drag = null;
const dateLong = date => new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Shanghai'}).format(new Date(date+'T12:00:00+08:00'));
const blocks = () => live.busy;
const validity = () => validateRange({...state,busy:blocks(),scenario:live.ready?'normal':'error',now:currentTime()});
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
    button.addEventListener('click',()=>{state.date=date;void loadDate();});
    $('calendar').append(button);
  }
  $('prev-month').disabled=month<=today.slice(0,7);
  $('next-month').disabled=month>=last.slice(0,7);
}
function renderBusy() {
  $('busy-blocks').replaceChildren();
  for(const b of blocks()) {
    const visibleStart=Math.max(OPEN,b.start),visibleEnd=Math.min(CLOSE,b.end);
    if(visibleEnd<=visibleStart)continue;
    const element=document.createElement('div');element.className=`busy-block${b.id?' demo-booking':''}`;
    element.style.top=`${(visibleStart-OPEN)/(CLOSE-OPEN)*100}%`;element.style.height=`${(visibleEnd-visibleStart)/(CLOSE-OPEN)*100}%`;
    const label=document.createElement('strong');label.textContent=b.id?'演示预约':'忙碌';
    const time=document.createElement('span');time.textContent=`${timeText(b.start)}–${timeText(b.end)}`;
    element.append(label,time);$('busy-blocks').append(element);
  }
}
function renderRange(syncInputs=true) {
  const valid=validity(), selection=$('selection');
  const usable=Number.isFinite(state.start)&&Number.isFinite(state.end)&&state.end>state.start&&state.start>=OPEN&&state.end<=CLOSE;
  selection.hidden=!usable||!live.ready;
  if(usable) {selection.style.top=`${(state.start-OPEN)/(CLOSE-OPEN)*100}%`;selection.style.height=`${(state.end-state.start)/(CLOSE-OPEN)*100}%`;}
  selection.classList.toggle('conflict',!valid.ok);
  selection.classList.toggle('compact',state.end-state.start<40);
  $('range-label').textContent=`${timeText(state.start)}–${timeText(state.end)}`;
  $('range-duration').textContent=durationText(state.end-state.start);
  $('duration-summary').textContent=durationText(state.end-state.start);
  $('availability-status').textContent=valid.message;
  $('availability-status').classList.toggle('invalid',!valid.ok);
  $('continue').disabled=!valid.ok;
  $('timeline-unavailable').hidden=live.ready;
  if(syncInputs) {$('start-time').value=timeText(state.start);$('end-time').value=timeText(state.end);}
}
function render() {
  CLOSE=closingMinute(state.date);
  const labels=document.querySelector('.time-labels');labels.replaceChildren();
  for(let minute=OPEN;minute<=CLOSE;minute+=60){const label=document.createElement('span');label.textContent=timeText(minute);labels.append(label);}
  $('timeline').style.setProperty('--hours',String((CLOSE-OPEN)/60));
  $('timeline').style.setProperty('--quarters',String((CLOSE-OPEN)/15));
  $('timeline').style.height=CLOSE===1440?'660px':'';
  $('timeline').setAttribute('aria-label',`13:00至${timeText(CLOSE)}时间轴，可在右侧输入框精确选择`);
  $('hours-summary').textContent=`当天 13:00–${timeText(CLOSE)}`;
  $('start-time').max=CLOSE===1440?'23:59':'18:59';
  renderCalendar();renderBusy();renderRange();
  $('selected-date').textContent=dateLong(state.date);$('summary-date').textContent=dateLong(state.date);
}
for(const direction of ['prev','next']) $(direction+'-month').addEventListener('click',()=>{
  const [year,m]=month.split('-').map(Number);month=new Date(Date.UTC(year,m-1+(direction==='next'?1:-1),1)).toISOString().slice(0,7);renderCalendar();
});
for(const type of ['start','end']) $(type+'-time').addEventListener('input',()=>{state[type]=toMinutes($(type+'-time').value);renderRange(false);});
const timeline=$('timeline');
function pointerMinute(event) {const bounds=timeline.getBoundingClientRect();return Math.max(OPEN,Math.min(CLOSE,OPEN+Math.round((event.clientY-bounds.top)/bounds.height*(CLOSE-OPEN)/15)*15));}
timeline.addEventListener('pointerdown',event=>{
  if(event.button!==0||!live.ready) return;
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
function recap() {return `${dateLong(state.date)}\n${timeText(state.start)}–${timeText(state.end)} · ${durationText(state.end-state.start)}\n北京时间 UTC+8`;}
$('continue').addEventListener('click',async()=>{
  if(openExisting())return;
  if(!validity().ok) {renderRange();return;}
  $('form-recap').textContent=recap();$('contact-step').hidden=false;$('success-step').hidden=true;$('form-error').hidden=true;
  $('booking-dialog').showModal();$('guest-name').focus();
  try{await mountChallenge();}catch(error){$('form-error').textContent=error.message;$('form-error').hidden=false;}
});
$('close-dialog').addEventListener('click',()=>$('booking-dialog').close());
$('booking-form').addEventListener('submit',async event=>{
  event.preventDefault();const valid=validity();
  if(!valid.ok&&!retryingRequest()){$('form-error').textContent=valid.message;$('form-error').hidden=false;return;}
  if(!$('guest-name').value.trim()){$('form-error').textContent='请填写称呼。';$('form-error').hidden=false;return;}
  const midnight=Date.parse(state.date+'T00:00:00+08:00')/1000;
  try{await submit({start:midnight+state.start*60,end:midnight+state.end*60,name:$('guest-name').value,email:$('guest-email').value,topic:$('guest-topic').value});}
  catch(error){$('form-error').textContent=error.message;$('form-error').hidden=false;}
});
$('booking-dialog').addEventListener('close',()=>{$('booking-dialog').setAttribute('aria-labelledby','dialog-title');});
let requestVersion=0;
async function loadDate(){
  const version=++requestVersion;live.ready=false;live.busy=[];render();$('refresh-state').textContent='正在查询忙闲';
  try{const busy=await readDay(state.date);if(version!==requestVersion)return;live.busy=busy;live.ready=true;render();$('refresh-state').textContent='已更新忙闲；提交时还会再次核对。';}
  catch(error){if(version!==requestVersion)return;live.ready=false;render();$('availability-status').textContent=error.message;$('refresh-state').textContent='忙闲查询暂不可用';}
}
$('refresh-availability').addEventListener('click',()=>void loadDate());
render();
initialize().then(()=>loadDate()).catch(error=>{$('availability-status').textContent=error.message;$('refresh-state').textContent='预约服务尚未启用';});
setInterval(()=>{if(!document.hidden)void loadDate();},60000);
