import { tr } from './i18n.ts';
import type { Subtask, Task } from './supabase.ts';

type Span = Pick<Subtask, 'start_date' | 'start_time' | 'end_date' | 'end_time'>;

/** "DD/MM HH:MM". */
export const fmtWhen = (date: string | null, time: string | null) =>
  [date && date.slice(5).split('-').reverse().join('/'), time?.slice(0, 5)].filter(Boolean).join(' ');

/** Read-only span: "10/11 09:00 – 10:30", "10/11 22:00 – 11/11 02:00", "10/11"; '' when unset. */
export function fmtSpan(x: Span) {
  if (!x.start_date) return '';
  const start = fmtWhen(x.start_date, x.start_time);
  const endDay = x.end_date ?? x.start_date;
  const end = endDay === x.start_date ? x.end_time?.slice(0, 5) ?? '' : fmtWhen(endDay, x.end_time);
  return end ? `${start} – ${end}` : start;
}

/** Where a subtask stands at `now` ("YYYY-MM-DD HH:MM"): late (end passed), now (inside its span), or '' (done, unset, later).
 *  A missing start time is 00:00, a missing end the end of its last day. */
export function subStatus(x: Span & { done: boolean }, now: string): 'late' | 'now' | '' {
  if (x.done || !x.start_date) return '';
  const start = `${x.start_date} ${x.start_time?.slice(0, 5) ?? '00:00'}`;
  const end = `${x.end_date ?? x.start_date} ${x.end_time?.slice(0, 5) ?? '23:59'}`;
  return end < now ? 'late' : start <= now ? 'now' : '';
}

/** Length of a timed span: "45 phút", "1h30", "2h"; '' without both times. Same arithmetic across days. */
export function spanLength(x: Span) {
  if (!x.start_date || !x.start_time || !x.end_time) return '';
  const min = (d: string, t: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), +t.slice(0, 2), +t.slice(3, 5)) / 60_000;
  const m = min(x.end_date ?? x.start_date, x.end_time) - min(x.start_date, x.start_time);
  if (m <= 0) return '';
  if (m < 60) return tr('{n} phút', { n: m });
  return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
}

const at = (date: string, time: string | null) => (time ? `${date} ${time.slice(0, 5)}` : date);

/** Why a subtask's span is invalid or falls outside its parent's, or '' when it fits.
 *  A date without a time is compared by day only, so "the parent's start day" fits a parent starting at 09:00. */
export function spanError(parent: Pick<Task, 'due_date' | 'due_time' | 'end_date' | 'end_time'>, sub: Span) {
  if (!sub.start_date && !sub.end_date) return '';
  if (!sub.start_date) return tr('Đặt lúc kết thúc thì cần có lúc bắt đầu');
  if (!parent.due_date) return tr('Việc cha chưa có ngày, nên việc con chưa đặt ngày được');
  const endDate = sub.end_date ?? sub.start_date;
  if (sub.end_time && !sub.start_time) return tr('Đặt giờ kết thúc thì cần có giờ bắt đầu');
  const subStart = at(sub.start_date, sub.start_time);
  const subEnd = at(endDate, sub.end_time);
  // With a time on both sides the end must be later; otherwise only the day can't go backwards.
  if (sub.start_time && sub.end_time ? subEnd <= subStart : endDate < sub.start_date) return tr('Lúc kết thúc phải sau lúc bắt đầu');
  // Parent span: a missing start time is 00:00, a missing end time is the end of its last day.
  const pStart = at(parent.due_date, parent.due_time ?? '00:00');
  const pEnd = at(parent.end_date ?? parent.due_date, parent.end_time ?? '23:59');
  const day = (x: string, p: string) => (x.length === 10 ? p.slice(0, 10) : p); // a day-only side compares by day
  if (subStart < day(subStart, pStart) || subEnd > day(subEnd, pEnd)) {
    return tr('Phải nằm trong thời gian của việc cha ({from} – {to})', {
      from: fmtWhen(parent.due_date, parent.due_time),
      to: fmtWhen(parent.end_date ?? parent.due_date, parent.end_time ?? '23:59'),
    });
  }
  return '';
}
