// One-time extension, interpreted in Asia/Shanghai. End is exclusive midnight.
export const HOURS_EXCEPTION = Object.freeze({from:'2026-10-05',through:'2026-10-12',open:'13:00',close:'24:00'});
export function closingMinute(date) {
  return date >= HOURS_EXCEPTION.from && date <= HOURS_EXCEPTION.through ? 1440 : 1140;
}
