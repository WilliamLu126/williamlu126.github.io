export const OPEN = 13 * 60;
export const CLOSE = 19 * 60;
export const BUFFER = 15;
export const DAY = 86400000;
export function beijingDate(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
export function addDays(date, days) { return new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10); }
export function toMinutes(value) { if (!/^\d{2}:\d{2}$/.test(value)) return NaN; const [h,m] = value.split(':').map(Number); return h < 24 && m < 60 ? h * 60 + m : NaN; }
export function timeText(value) { return Number.isFinite(value) ? `${String(Math.floor(value / 60)).padStart(2,'0')}:${String(value % 60).padStart(2,'0')}` : '—'; }
export function durationText(value) { if (!Number.isFinite(value) || value <= 0) return '—'; const h = Math.floor(value/60), m = value%60; return [h ? `${h} 小时` : '', m ? `${m} 分钟` : ''].filter(Boolean).join(' '); }
export function validateRange({date, start, end, busy, scenario = 'normal', now = Date.now()}) {
  if (scenario === 'error') return {ok:false, message:'忙闲查询失败，暂不能预约。请稍后重试。'};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || ![start,end].every(Number.isFinite)) return {ok:false, message:'请填写完整的开始和结束时间。'};
  if (start < OPEN || end > CLOSE || start >= CLOSE || end <= OPEN) return {ok:false, message:'请选择北京时间 13:00–19:00 内的时段。'};
  if (end <= start) return {ok:false, message:'结束时间需要晚于开始时间。'};
  const stamp = Date.parse(`${date}T${timeText(start)}:00+08:00`);
  if (!Number.isFinite(stamp) || stamp < now + DAY) return {ok:false, message:'请至少提前 24 小时预约，或选择其他日期。'};
  if (stamp > now + 30 * DAY) return {ok:false, message:'目前只开放未来 30 天的预约。'};
  if (busy.some(b => start < b.end && end > b.start)) return {ok:false, message:'所选时间与忙碌时段重叠，请调整起止时间。'};
  if (busy.some(b => start < b.end + BUFFER && end > b.start - BUFFER)) return {ok:false, message:'请与忙碌时段前后各留 15 分钟间隔。'};
  return {ok:true, message:'这段时间可约，已避开演示忙碌与缓冲时段。'};
}
export function demoBusy(date, scenario) {
  if (scenario === 'error') return [];
  if (scenario === 'full') return [{start:OPEN,end:CLOSE}];
  const day = Number(date.slice(-2));
  return day % 3 === 0 ? [{start:15*60,end:15*60+45},{start:17*60+30,end:18*60}] : [{start:14*60+30,end:15*60+15},{start:17*60,end:17*60+45}];
}
