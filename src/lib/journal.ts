import { today, toIso } from './dates.ts';
import type { Project, Task } from './supabase.ts';
import { tagCounts } from './tags.ts';

export const INBOX = 'Hộp thư';

/** Done entries of one day grouped by project: Hộp thư first, then projects by name. */
export function groupByProject(entries: Task[], projects: Project[]) {
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const groups = new Map<string | null, Task[]>();
  for (const t of [...entries].sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''))) {
    const key = t.project_id && names.has(t.project_id) ? t.project_id : null;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups]
    .map(([id, items]) => ({ id, name: id ? names.get(id)! : INBOX, items }))
    .sort((a, b) => (a.id === null ? -1 : b.id === null ? 1 : a.name.localeCompare(b.name, 'vi')));
}

/** R12: tasks done that day, and tasks due that day but not done by its end (by the stored due date). Today and later: nothing missed yet. */
export function dayCounts(rows: Task[], day: string, todayIso = today()) {
  return {
    done: rows.filter((t) => t.completed_day === day).length,
    missed: day >= todayIso ? 0 : rows.filter((t) => t.due_date === day && (!t.completed_day || t.completed_day > day)).length,
  };
}

/** Done count for every day of a month (month is 1-based); days without entries are 0. */
export function monthCounts(rows: Task[], year: number, month: number) {
  const counts: Record<string, number> = {};
  const days = new Date(year, month, 0).getDate();
  for (let d = 1; d <= days; d++) counts[toIso(new Date(year, month - 1, d))] = 0;
  for (const t of rows) if (t.completed_day && t.completed_day in counts) counts[t.completed_day]++;
  return counts;
}

/** Figures for a run of days (Stats screen): done per day, missed (R12), the share of due tasks done on time
 *  (null with nothing due yet), and what got done by project and by tag, biggest first. */
export function periodStats(rows: Task[], days: string[], projects: Project[], todayIso = today()) {
  const inRange = new Set(days);
  const done = rows.filter((t) => t.completed_day && inRange.has(t.completed_day));
  const perDay = days.map((d) => done.filter((t) => t.completed_day === d).length);
  const missed = days.reduce((n, d) => n + dayCounts(rows, d, todayIso).missed, 0);
  const due = rows.filter((t) => t.due_date && inRange.has(t.due_date) && t.due_date < todayIso).length;
  return {
    perDay,
    done: done.length,
    missed,
    due,
    rate: due ? (due - missed) / due : null,
    byProject: groupByProject(done, projects).map((g) => ({ id: g.id, name: g.name, n: g.items.length })).sort((a, b) => b.n - a.n),
    byTag: tagCounts(done),
  };
}
