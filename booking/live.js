// No OAuth credentials or database keys belong in the browser.
let endpoint=null,configuration=null;
let widget=null,challenge='',challengeReady=null;
let receipt=null,requestPayload=null;
let deliveryUncertain=false;
let approvedTestId=null;
const $=id=>document.getElementById(id);
const labels={temporarily_unavailable:'暂时无法核对空闲时间，请稍后再试。',time_conflict:'这段时间刚被占用，请重新选择。',outside_window:'请选择开放范围内、至少提前24小时的时段。',verification_required:'请先完成预约验证。',verification_failed:'预约验证已失效，请重新验证。',too_many_requests:'提交过于频繁，请稍后再试。',service_unavailable:'连接暂时中断，请稍后再试。',request_expired:'这次请求未能及时确认，请重新预约。'};
export const live={ready:false,busy:[],nowOffset:0};
export function currentTime(){return Date.now()+live.nowOffset;}
export function retryingRequest(){return deliveryUncertain&&Boolean(receipt&&requestPayload);}
export async function api(action,data={}){
  if(!endpoint)throw new Error('预约服务正在准备中，请暂用 Google 预约。');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data}),signal:AbortSignal.timeout(20000)});
  const value=await response.json();
  if(!response.ok||value.error&&!value.status){const error=new Error(labels[value.error]||'暂时无法处理，请稍后再试。');error.code=value.error;throw error;}
  return value;
}
export async function initialize(){
  const config=await(await fetch('./config.json',{cache:'no-store'})).json();
  if(typeof config.endpoint!=='string'||!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/functions\/v1\/booking-api$/.test(config.endpoint))throw new Error('预约服务正在准备中，请暂用 Google 预约。');
  endpoint=config.endpoint;configuration=await api('config');
  const parts=new URLSearchParams(location.hash.slice(1));
  const requestedTest=parts.get('request')||'';
  if(configuration.testMode&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestedTest))approvedTestId=requestedTest;
  if(/^[0-9a-f-]{36}$/.test(parts.get('booking')||'')&&/^[0-9a-f]{64}$/.test(parts.get('key')||'')){
    receipt={id:parts.get('booking'),token:parts.get('key')};showReceipt();void pollReceipt();
  }
  if(!configuration.enabled)throw new Error('当前暂停接收新预约，请使用 Google 预约或稍后再试。');
  if(configuration.testMode&&!approvedTestId)throw new Error('预约服务正在验证中，请暂用 Google 预约。');
  return configuration;
}
export async function readDay(date){
  live.ready=false;
  if(!configuration?.enabled||(configuration.testMode&&!approvedTestId))throw new Error('当前暂停接收新预约，请使用 Google 预约或稍后再试。');
  const result=await api('availability',{date});
  if(!Array.isArray(result.busy)||!Number.isSafeInteger(result.now)||!Number.isSafeInteger(result.checked_at)||result.now-result.checked_at>120)throw new Error('忙闲数据暂不可用，请稍后刷新。');
  const midnight=Date.parse(date+'T00:00:00+08:00')/1000;
  const busy=result.busy.map(pair=>{
    if(!Array.isArray(pair)||pair.length!==2||!pair.every(Number.isSafeInteger)||pair[1]<=pair[0])throw new Error('忙闲数据暂不可用，请稍后刷新。');
    return {start:(pair[0]-midnight)/60,end:(pair[1]-midnight)/60};
  }).filter(b=>b.end>b.start);
  live.nowOffset=result.now*1000-Date.now();
  return busy;
}
function loadChallenge(){
  if(challengeReady)return challengeReady;
  challengeReady=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
    script.onload=resolve;script.onerror=()=>{challengeReady=null;reject(new Error('预约验证暂不可用，请稍后再试。'));};document.head.append(script);
  });return challengeReady;
}
export async function mountChallenge(){
  challenge='';$('confirm-booking').disabled=true;
  await loadChallenge();
  if(widget!==null)window.turnstile.remove(widget);
  widget=window.turnstile.render('#booking-verification',{sitekey:configuration.siteKey,action:'booking',theme:'light',size:'flexible',callback:token=>{challenge=token;$('confirm-booking').disabled=false;},'expired-callback':()=>{challenge='';$('confirm-booking').disabled=true;},'error-callback':()=>{challenge='';$('confirm-booking').disabled=true;}});
}
function receiptUrl(){return location.origin+location.pathname+'#'+new URLSearchParams({booking:receipt.id,key:receipt.token});}
function showReceipt(){
  $('contact-step').hidden=true;$('success-step').hidden=false;
  $('booking-dialog').setAttribute('aria-labelledby','success-title');
  if(!$('booking-dialog').open)$('booking-dialog').showModal();
  $('success-title').textContent='正在核对预约';$('receipt-message').textContent='确认日历写入后，这里会显示预约成功。';
  $('success-note').textContent='请保存这次预约的管理链接。你可以用它查看结果或取消预约，请勿转发给他人。';
  $('cancel-booking').disabled=false;
  $('new-booking').hidden=true;
  $('retry-booking').hidden=true;
}
export function openExisting(){if(!receipt)return false;showReceipt();void pollReceipt();return true;}
let pollRun=0;
async function pollReceipt(){
  const run=++pollRun;
  for(let attempt=0;attempt<60&&run===pollRun;attempt++){
    try{
      const value=await api('status',receipt);
      if(run!==pollRun)return;
      if(Number.isSafeInteger(value.start)&&Number.isSafeInteger(value.end))$('success-recap').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long',hour:'2-digit',minute:'2-digit',hour12:false}).format(value.start*1000)+'–'+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(value.end*1000)+'\n北京时间';
      $('retry-booking').hidden=true;
      $('cancel-booking').disabled=value.can_cancel===false;
      if(value.status==='confirmed'){$('success-title').textContent=value.can_cancel===false?'预约已结束':'预约成功';$('receipt-message').textContent=value.can_cancel===false?'这次预约已结束，仍可查看时间记录。':'已加入 William Lu 的日历，确认邀请将由 Google 发往你填写的邮箱。';$('cancel-booking').disabled=value.can_cancel===false;$('new-booking').hidden=false;return;}
      if(['cancelled','rejected'].includes(value.status)){$('success-title').textContent=value.status==='cancelled'?'预约已取消':'这次预约未完成';$('receipt-message').textContent=value.status==='cancelled'?'本次预约已取消，相关日历更新会随同步完成。':labels[value.error]||'未能确认这个时段，请重新选择或联系 William Lu。';$('cancel-booking').disabled=true;$('new-booking').hidden=false;return;}
      $('success-title').textContent=value.status==='cancel_pending'?'正在取消预约':'正在核对预约';
      $('receipt-message').textContent=value.status==='uncertain'?'写入结果还在核实中，请勿重复预约；也可以申请取消。':'请稍候，只有日历操作确认后才会显示完成。';
    }catch(error){
      if(run!==pollRun)return;
      if(error.code==='not_found'){
        $('success-title').textContent='尚未查到这次请求';
        $('receipt-message').textContent=requestPayload?'可以重新验证并提交同一次请求，系统会保留原请求编号，避免重复预约。':'尚未找到对应预约。请检查管理链接是否完整，或联系 William Lu 核对；目前不能确认预约成功或取消。';
        $('retry-booking').hidden=!requestPayload;
        $('cancel-booking').disabled=true;
      }else $('receipt-message').textContent='连接暂时中断，结果尚未确认。请保存管理链接，稍后重新打开查看。';
    }
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  if(run===pollRun&&$('retry-booking').hidden)$('receipt-message').textContent='核对尚未完成。请保存管理链接，稍后重新打开查看，或联系 William Lu 核对。';
}
export async function submit(values){
  if(!challenge)throw new Error('请先完成预约验证。');
  if(!receipt){receipt={id:approvedTestId||crypto.randomUUID(),token:[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('')};requestPayload={...values,...receipt};}
  const immutable=requestPayload;
  $('confirm-booking').disabled=true;
  try{
    await api('reserve',{...immutable,challenge});
    history.replaceState(null,'',receiptUrl());showReceipt();void pollReceipt();
  }catch(error){
    const definite=['temporarily_unavailable','time_conflict','outside_window','verification_required','verification_failed','too_many_requests','invalid_request'].includes(error.code);
    if(definite){if(!deliveryUncertain){receipt=null;requestPayload=null;}await mountChallenge();throw error;}
    // Unknown delivery: retain one request identity and show a status receipt.
    deliveryUncertain=true;
    history.replaceState(null,'',receiptUrl());showReceipt();void pollReceipt();
  }
}
$('copy-management').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(receiptUrl());$('copy-management').textContent='管理链接已复制';}catch{$('success-note').textContent='请复制浏览器地址栏中的完整地址，保存为你的私人管理链接。';}});
$('cancel-booking').addEventListener('click',async()=>{
  if(!receipt)return;$('cancel-booking').disabled=true;
  try{await api('cancel',receipt);void pollReceipt();}catch{$('receipt-message').textContent='取消请求尚未确认，请稍后再试。';$('cancel-booking').disabled=false;}
});
$('back-to-calendar').addEventListener('click',()=>$('booking-dialog').close());
$('retry-booking').addEventListener('click',async()=>{
  if(!requestPayload||!receipt)return;
  pollRun++;
  $('contact-step').hidden=false;$('success-step').hidden=true;
  $('booking-dialog').setAttribute('aria-labelledby','dialog-title');
  // Retry exactly the immutable original body, including the original identity.
  for(const field of ['name','email','topic']){$('guest-'+field).value=requestPayload[field];$('guest-'+field).readOnly=true;}
  $('form-error').textContent='重新提交的是同一次请求，时间和联系方式保持原样。';$('form-error').hidden=false;
  try{await mountChallenge();}catch(error){$('form-error').textContent=error.message;}
});
$('new-booking').addEventListener('click',()=>{pollRun++;receipt=null;requestPayload=null;deliveryUncertain=false;history.replaceState(null,'',location.pathname);location.reload();});
