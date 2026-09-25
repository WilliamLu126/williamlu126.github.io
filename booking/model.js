export const OPEN = 13 * 60;
export const CLOSE = 19 * 60;
export const BUFFER = 15;
import {closingMinute} from './hours.mjs';
export {closingMinute} from './hours.mjs';
export const DAY = 86400000;
export function beijingDate(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
export function addDays(date, days) { return new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10); }
export function toMinutes(value) { if (value==='24:00') return 1440; if (!/^\d{2}:\d{2}$/.test(value)) return NaN; const [h,m] = value.split(':').map(Number); return h < 24 && m < 60 ? h * 60 + m : NaN; }
export function timeText(value) { return Number.isFinite(value) ? `${String(Math.floor(value / 60)).padStart(2,'0')}:${String(value % 60).padStart(2,'0')}` : '—'; }
export function durationText(value) { if (!Number.isFinite(value) || value <= 0) return '—'; const h = Math.floor(value/60), m = value%60; return [h ? `${h} 小时` : '', m ? `${m} 分钟` : ''].filter(Boolean).join(' '); }
export function validateRange({date, start, end, busy, scenario = 'normal', now = Date.now()}) {
  if (scenario === 'error') return {ok:false, message:'忙闲查询失败，暂不能预约。请稍后重试。'};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || ![start,end].every(Number.isFinite)) return {ok:false, message:'请填写完整的开始和结束时间。'};
  const close=closingMinute(date);
  if (start < OPEN || end > close || start >= close || end <= OPEN) return {ok:false, message:`请选择北京时间 13:00–${timeText(close)} 内的时段。`};
  if (end <= start) return {ok:false, message:'结束时间需要晚于开始时间。'};
  const midnight = Date.parse(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(midnight) || beijingDate(midnight)!==date) return {ok:false,message:'请选择有效日期。'};
  const stamp = midnight + start * 60000;
  if (!Number.isFinite(stamp) || stamp < now + DAY) return {ok:false, message:'请至少提前 24 小时预约，或选择其他日期。'};
  if (stamp + (end-start)*60000 > now + 30 * DAY) return {ok:false, message:'目前只开放未来 30 天的预约。'};
  if (busy.some(b => start < b.end && end > b.start)) return {ok:false, message:'所选时间与忙碌时段重叠，请调整起止时间。'};
  if (busy.some(b => start < b.end + BUFFER && end > b.start - BUFFER)) return {ok:false, message:'请与忙碌时段前后各留 15 分钟间隔。'};
  return {ok:true, message:'这段时间当前可约，提交时会再次核对。'};
}
