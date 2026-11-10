// Daily report rules: due by 21:00 local, late reports still count but are marked; stats and search. Pure (node-checked).
import { addDays, fromIso, localDay } from './dates.ts';
import { tr } from './i18n.ts';
import type { Report, Task } from './supabase.ts';

export const DEADLINE = '21:00';

/** Whether a report for `day` saved at `at` is past the deadline (later that evening or any later day). */
export function isLate(day: string, at: Date) {
  const d = localDay(at);
  const hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  return d > day || (d === day && hm > DEADLINE);
}

export type Status = 'ontime' | 'late' | 'missing' | 'pending' | 'none';

/** A day's report state. `since` is the first day the user ever reported: older days are 'none', not missing. */
export function reportStatus(day: string, report: Pick<Report, 'late'> | undefined, since: string | null, now = new Date()) {
  if (report) return report.late ? 'late' : 'ontime';
  const today = localDay(now);
  if (day > today || !since || day < since) return 'none';
  if (day === today && !isLate(day, now)) return 'pending';
  return 'missing';
}

/** Counts over `days`, plus runs of consecutive days ending today (or yesterday while today has no report yet):
 *  `streak` counts any report, `ontimeStreak` only reports in by the deadline (a late one breaks it). */
export function reportStats(days: string[], reports: Pick<Report, 'day' | 'late'>[], since: string | null, now = new Date()) {
  const by = new Map(reports.map((r) => [r.day, r]));
  const count = { ontime: 0, late: 0, missing: 0 };
  for (const d of days) {
    const st = reportStatus(d, by.get(d), since, now);
    if (st === 'ontime' || st === 'late' || st === 'missing') count[st]++;
  }
  const start = by.has(localDay(now)) ? localDay(now) : addDays(localDay(now), -1);
  const run = (keep: (r: Pick<Report, 'late'>) => boolean) => {
    let n = 0;
    for (let d = start; by.has(d) && keep(by.get(d)!); d = addDays(d, -1)) n++;
    return n;
  };
  return { ...count, streak: run(() => true), ontimeStreak: run((r) => !r.late) };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&${({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' } as Record<string, string>)[c]};`);

/** Starting point for a new report: the day's done tasks by project, what slipped, and empty sections to fill in. */
export function draftHtml(groups: { name: string; items: Pick<Task, 'title'>[] }[], missed: Pick<Task, 'title'>[]) {
  const list = (items: string[]) => `<ul>${(items.length ? items : ['']).map((i) => `<li>${i}</li>`).join('')}</ul>`;
  const done = groups.flatMap((g) => g.items.map((t) => `<b>${esc(g.name)}</b>: ${esc(t.title)}`));
  return [
    `<h3>${tr('Đã làm')}</h3>`,
    list(done),
    ...(missed.length ? [`<h3>${tr('Chưa xong')}</h3>`, list(missed.map((t) => esc(t.title)))] : []),
    `<h3>${tr('Vướng mắc')}</h3>`,
    '<p></p>',
    `<h3>${tr('Kế hoạch ngày mai')}</h3>`,
    list([]),
  ].join('');
}

/** Case- and accent-insensitive: "bao cao" finds "Báo cáo". */
// Per character, so a folded string keeps the original's indexes (snippet relies on it).
export const fold = (s: string) => s.replace(/[^\u0000-\u007f]/g, (c) => (/[đĐ]/.test(c) ? 'd' : c.normalize('NFD')[0])).toLowerCase();
export const matches = (body: string, q: string) => fold(body).includes(fold(q.trim()));

/** A short excerpt around the first match (or the start). */
export function snippet(body: string, q: string, len = 140) {
  const text = body.replace(/\s+/g, ' ').trim();
  const at = q.trim() ? fold(text).indexOf(fold(q.trim())) : -1;
  const start = Math.max(0, at - 40);
  const cut = text.slice(start, start + len);
  return (start > 0 ? '…' : '') + cut + (start + len < text.length ? '…' : '');
}

/** When to nudge for the report: 30 minutes before and at the deadline, for the next `days` days not yet reported. */
export function reportReminders(reported: Set<string>, now = new Date(), days = 7) {
  const [h, m] = DEADLINE.split(':').map(Number);
  const out: { at: Date; last: boolean }[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(localDay(now), i);
    if (reported.has(day)) continue;
    for (const [before, last] of [[30, false], [0, true]] as const) {
      const at = fromIso(day);
      at.setHours(h, m - before, 0, 0);
      if (at > now) out.push({ at, last });
    }
  }
  return out;
}
