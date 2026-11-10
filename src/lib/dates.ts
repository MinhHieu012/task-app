// Dates travel as "YYYY-MM-DD" strings (Postgres `date`), always in device-local time.
import { tr } from './i18n.ts';

const pad = (n: number) => String(n).padStart(2, '0');

export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function fromIso(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local calendar day of a moment (R16). */
export const localDay = (at: Date = new Date()) => toIso(at);
export const today = () => localDay();

export function addDays(iso: string, n: number) {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** "DD/MM" for display; adds the year when it isn't the current one. */
export function fmtDay(iso: string) {
  const [y, m, d] = iso.split('-');
  return y === String(new Date().getFullYear()) ? `${d}/${m}` : `${d}/${m}/${y}`;
}

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
/** "Thứ Ba, 10/11" in the app's language. */
export const dayTitle = (iso: string) => `${tr(WEEKDAY[fromIso(iso).getDay()])}, ${fmtDay(iso)}`;

/** Greeting for an hour of the day: morning 5–11, afternoon 12–17, evening otherwise. */
export const greeting = (hour: number) =>
  hour >= 5 && hour < 12 ? tr('Chào buổi sáng') : hour >= 12 && hour < 18 ? tr('Chào buổi chiều') : tr('Chào buổi tối');

/** "DD/MM/YYYY", always with the year (report dates, read back long after). */
export const fmtDate = (iso: string) => iso.split('-').reverse().join('/');

const lastDayOf = (y: number, m: number) => new Date(y, m + 1, 0).getDate(); // m is 0-based

/**
 * Next due date of a recurring task: the first occurrence after max(due, today) (KTD6).
 * repeat: daily | weekly:<0..6,...> (0 = Sunday) | monthly:<day> | every:<N>
 */
export function nextDue(repeat: string, due: string, todayIso = today()) {
  const base = due > todayIso ? due : todayIso;
  const [kind, arg] = repeat.split(':');

  if (kind === 'daily' || kind === 'every') {
    const n = kind === 'daily' ? 1 : Number(arg);
    let d = due;
    while (d <= base) d = addDays(d, n);
    return d;
  }
  if (kind === 'weekly') {
    const days = arg.split(',').map(Number);
    let d = addDays(base, 1);
    while (!days.includes(fromIso(d).getDay())) d = addDays(d, 1);
    return d;
  }
  if (kind === 'monthly') {
    const day = Number(arg);
    const b = fromIso(base);
    for (let i = 0; ; i++) {
      const y = b.getFullYear(), m = b.getMonth() + i;
      const d = toIso(new Date(y, m, Math.min(day, lastDayOf(y, m))));
      if (d > base) return d;
    }
  }
  throw new Error(`Unknown repeat: ${repeat}`);
}

/** Days of a month (1-based) as ISO strings, led by nulls so the 1st falls under its weekday (weeks start Monday). */
export function monthGrid(year: number, month: number) {
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const n = lastDayOf(year, month - 1);
  return [...Array<null>(lead).fill(null), ...Array.from({ length: n }, (_, i) => toIso(new Date(year, month - 1, i + 1)))];
}

/** "DD/MM" or "DD/MM/YYYY" -> ISO date, or null when invalid. Without a year, the next such date from today. */
export function parseDate(s: string, todayIso = today()) {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!m) return null;
  const day = +m[1], month = +m[2];
  const valid = (y: number) => {
    const d = new Date(y, month - 1, day);
    return d.getMonth() === month - 1 && d.getDate() === day ? toIso(d) : null;
  };
  if (m[3]) return valid(+m[3]);
  const y = fromIso(todayIso).getFullYear();
  const thisYear = valid(y);
  return thisYear && thisYear >= todayIso ? thisYear : valid(y + 1);
}

/** "HH:MM" -> "HH:MM" (zero-padded), or null when invalid. */
export function parseTime(s: string) {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${pad(+m[1])}:${m[2]}`;
}

/** Upcoming screen ranges. `n` steps whole quarters/years ahead (0 = the current one). */
export type Span = '3d' | '1w' | '2w' | '1m' | 'q' | 'y';

/** [from, to] for a span, both inclusive; never starts before tomorrow (today has its own screen). */
export function spanRange(span: Span, todayIso = today(), n = 0): [string, string] {
  const tomorrow = addDays(todayIso, 1);
  const t = fromIso(todayIso);
  const y = t.getFullYear(), m = t.getMonth();
  const days = { '3d': 3, '1w': 7, '2w': 14 } as const;
  if (span in days) return [tomorrow, addDays(todayIso, days[span as keyof typeof days])];
  if (span === '1m') return [tomorrow, toIso(new Date(y, m + 1, Math.min(t.getDate(), lastDayOf(y, m + 1))))];
  // Date() rolls month/year overflow, so quarter n of a later year just works.
  const [start, end] = span === 'q'
    ? [new Date(y, m - (m % 3) + 3 * n, 1), new Date(y, m - (m % 3) + 3 * n + 3, 0)]
    : [new Date(y + n, 0, 1), new Date(y + n, 11, 31)];
  const from = toIso(start);
  return [from > tomorrow ? from : tomorrow, toIso(end)];
}
