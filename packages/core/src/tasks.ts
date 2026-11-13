// Task display rules that were inline in the mobile components (TaskRow): grouping by deadline, lateness,
// time ranges, repeat and priority labels. Pure (node-checked).
import { addDays, fmtDay, fromIso, today } from './dates.ts';
import { tr } from './i18n.ts';
import type { Task } from './types.ts';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Last day a task is open: its end day, or its start day when it has no end. */
export const endDay = (t: Pick<Task, 'due_date' | 'end_date'>) => t.end_date ?? t.due_date;

/** Whole days between two ISO days. */
export const daysBetween = (from: string, to: string) => Math.round((fromIso(to).getTime() - fromIso(from).getTime()) / 86_400_000);

export type DueGroup = 'over' | 'today' | 'soon' | 'none';
export const DUE_LABEL: Record<DueGroup, string> = { over: 'Quá hạn', today: 'Hôm nay', soon: 'Sắp tới', none: 'Chưa hẹn' };

/** Open tasks split by deadline, overdue first; empty groups dropped. Labels are tr() keys (DUE_LABEL). */
export function groupByDue(open: Task[], day = today()): [DueGroup, Task[]][] {
  const groups: [DueGroup, Task[]][] = [
    ['over', open.filter((t) => t.due_date && endDay(t)! < day)],
    ['today', open.filter((t) => t.due_date && t.due_date <= day && endDay(t)! >= day)],
    ['soon', open.filter((t) => t.due_date && t.due_date > day)],
    ['none', open.filter((t) => !t.due_date)],
  ];
  return groups.filter(([, list]) => list.length);
}

/** "Hôm nay", "Hôm qua", "Ngày mai" or "DD/MM". */
export function dayName(d: string, todayIso = today()) {
  if (d === todayIso) return tr('Hôm nay');
  if (d === addDays(todayIso, -1)) return tr('Hôm qua');
  if (d === addDays(todayIso, 1)) return tr('Ngày mai');
  return fmtDay(d);
}

/** "09:00", "09:00–10:30", or "22:00 – Ngày mai 02:00" when the end is on another day. Quick add ends at 23:59: just the start. */
export function timeRange(t: Pick<Task, 'due_date' | 'due_time' | 'end_date' | 'end_time'>, todayIso = today()) {
  if (!t.due_time) return '';
  const start = t.due_time.slice(0, 5);
  if (!t.end_time || t.end_time.startsWith('23:59')) return start;
  const end = t.end_time.slice(0, 5);
  return t.end_date === t.due_date ? `${start}–${end}` : `${start} – ${dayName(t.end_date!, todayIso)} ${end}`;
}

export function repeatLabel(repeat: string) {
  const [kind, arg] = repeat.split(':');
  if (kind === 'daily') return tr('Hằng ngày');
  if (kind === 'weekly') return arg.split(',').map((d) => tr(DAYS[Number(d)])).join(', ');
  if (kind === 'monthly') return tr('Ngày {d} hằng tháng', { d: arg });
  return tr('Mỗi {n} ngày', { n: arg });
}

export const priorityLabel = (p: number) => (p === 4 ? tr('Bình thường') : tr('Ưu tiên {n}', { n: p }));

/** The form's repeat fields to the stored `repeat` (null when none). `due` sets the monthly day. */
export function buildRepeat(kind: '' | 'daily' | 'weekly' | 'monthly' | 'every', weekDays: number[], everyN: string, due: string | null) {
  if (kind === 'weekly') return `weekly:${[...weekDays].sort().join(',')}`;
  if (kind === 'monthly') return `monthly:${fromIso(due!).getDate()}`;
  if (kind === 'every') return `every:${everyN.trim()}`;
  return kind || null;
}

/** Unique rows by id: a done task that was also due in a range shows up in both queries. */
export const uniqueById = <T extends { id: string }>(...lists: T[][]) => [...new Map(lists.flat().map((t) => [t.id, t])).values()];
