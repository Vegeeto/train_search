/**
 * Time handling. The FGC timetable is in Europe/Madrid local time and expresses
 * after-midnight trains as `24:xx:xx`, so all comparisons use "seconds after the
 * service day's midnight" computed in Madrid time — never the viewer's timezone.
 */

export const TIMEZONE = 'Europe/Madrid';
const DAY = 86_400;

/** Hours before this count as the tail of the previous service day when picking a time. */
const SERVICE_DAY_START_HOUR = 3;

export interface MadridNow {
  /** `YYYY-MM-DD` in Madrid. */
  date: string;
  /** Seconds since midnight in Madrid. */
  seconds: number;
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function madridNow(at: Date = new Date()): MadridNow {
  const parts = Object.fromEntries(formatter.formatToParts(at).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    seconds: hour * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

/** `"24:54:00"` → 89 640. Returns NaN for anything malformed. */
export function parseGtfsTime(value: string | null | undefined): number {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value?.trim() ?? '');
  if (!match) return Number.NaN;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Service seconds → wall-clock `HH:MM` (24:10 → 00:10). */
export function formatClock(seconds: number): string {
  const s = ((Math.floor(seconds) % DAY) + DAY) % DAY;
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Express "now" on the timetable's clock. If the dataset is still yesterday's service
 * day (it is past midnight), now is 24:xx; if it already rolled over, now is plain time.
 */
export function serviceSeconds(now: MadridNow, serviceDate: string | undefined): number {
  if (!serviceDate || serviceDate === now.date) return now.seconds;
  if (addDays(serviceDate, 1) === now.date) return now.seconds + DAY;
  if (addDays(serviceDate, -1) === now.date) return now.seconds - DAY;
  return now.seconds;
}

/** A user-picked `HH:MM` on the service-day clock (00:30 → 24:30). */
export function pickedTimeToSeconds(value: string): number {
  const seconds = parseGtfsTime(value);
  if (Number.isNaN(seconds)) return Number.NaN;
  return seconds < SERVICE_DAY_START_HOUR * 3600 ? seconds + DAY : seconds;
}

/** Whole minutes from `now` until `target`, never negative. */
export function minutesUntil(target: number, now: number): number {
  return Math.max(0, Math.floor((target - now) / 60));
}
