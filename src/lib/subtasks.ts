import { parseDate, parseTime } from './dates.ts';
import type { Subtask, Task } from './supabase.ts';

type When = { date: string | null; time: string | null };
type Span = Pick<Subtask, 'start_date' | 'start_time' | 'end_date' | 'end_time'>;

/** "DD/MM HH:MM", "DD/MM" or "HH:MM" -> date + time; null when invalid.
 *  A bare time takes `day`; a DD/MM without year is the next such date from `day` (the parent's start). */
export function parseWhen(s: string, day: string | null): When | null {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { date: null, time: null };
  if (parts.length > 2) return null;
  const timePart = parts.find((p) => p.includes(':'));
  const datePart = parts.find((p) => p.includes('/'));
  if (parts.length !== Number(!!timePart) + Number(!!datePart)) return null;
  const date = datePart ? parseDate(datePart, day ?? undefined) : day;
  const time = timePart ? parseTime(timePart) : null;
  if ((datePart && !date) || (timePart && !time) || (time && !date)) return null;
  return { date, time };
}

/** Back to the input text: "DD/MM HH:MM". */
export const fmtWhen = (date: string | null, time: string | null) =>
  [date && date.slice(5).split('-').reverse().join('/'), time?.slice(0, 5)].filter(Boolean).join(' ');

const at = (date: string, time: string | null) => (time ? `${date} ${time.slice(0, 5)}` : date);

/** Why a subtask's span is invalid or falls outside its parent's, or '' when it fits.
 *  A date without a time is compared by day only, so "the parent's start day" fits a parent starting at 09:00. */
export function spanError(parent: Pick<Task, 'due_date' | 'due_time' | 'end_date' | 'end_time'>, sub: Span) {
  if (!sub.start_date && !sub.end_date) return '';
  if (!sub.start_date) return 'Đặt lúc kết thúc thì cần có lúc bắt đầu';
  if (!parent.due_date) return 'Việc cha chưa có ngày, nên việc con chưa đặt ngày được';
  const endDate = sub.end_date ?? sub.start_date;
  if (sub.end_time && !sub.start_time) return 'Đặt giờ kết thúc thì cần có giờ bắt đầu';
  const subStart = at(sub.start_date, sub.start_time);
  const subEnd = at(endDate, sub.end_time);
  // With a time on both sides the end must be later; otherwise only the day can't go backwards.
  if (sub.start_time && sub.end_time ? subEnd <= subStart : endDate < sub.start_date) return 'Lúc kết thúc phải sau lúc bắt đầu';
  // Parent span: a missing start time is 00:00, a missing end time is the end of its last day.
  const pStart = at(parent.due_date, parent.due_time ?? '00:00');
  const pEnd = at(parent.end_date ?? parent.due_date, parent.end_time ?? '23:59');
  const day = (x: string, p: string) => (x.length === 10 ? p.slice(0, 10) : p); // a day-only side compares by day
  if (subStart < day(subStart, pStart) || subEnd > day(subEnd, pEnd)) {
    return `Phải nằm trong thời gian của việc cha (${fmtWhen(parent.due_date, parent.due_time)} – ${fmtWhen(parent.end_date ?? parent.due_date, parent.end_time ?? '23:59')})`;
  }
  return '';
}
