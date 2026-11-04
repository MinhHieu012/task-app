import { toIso } from './dates.ts';
import type { Project, Task } from './supabase.ts';

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

/** R12: tasks done that day, and tasks due that day but not done by its end (by the stored due date). */
export function dayCounts(rows: Task[], day: string) {
  return {
    done: rows.filter((t) => t.completed_day === day).length,
    missed: rows.filter((t) => t.due_date === day && (!t.completed_day || t.completed_day > day)).length,
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
