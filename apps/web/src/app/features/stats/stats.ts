import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { addDays, daysIn, fmtDay, type Period, periodRange, shiftPeriod, today } from '@core/dates';
import { tr } from '@core/i18n';
import { dayCounts, periodStats } from '@core/journal';
import { reportStats } from '@core/reports';
import { uniqueById } from '@core/tasks';
import type { Project, Report, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { TrPipe } from '../../core/prefs.service';
import { DayChart } from '../../shared/day-chart';
import { Icon } from '../../shared/icon';

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`);

/** A week or month of work: done, missed, the share due that got done on time, reports, done per day, and what
 *  got done by project and by tag. The period is in the URL (?kind, ?at); no future periods. */
@Component({
  selector: 'app-stats',
  imports: [TrPipe, Icon, DayChart],
  templateUrl: './stats.html',
  styles: `
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .nav { display: flex; align-items: center; gap: 8px; margin-left: auto; }
    .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .line { display: grid; grid-template-columns: minmax(0, 160px) minmax(0, 1fr) 40px; align-items: center; gap: 12px; min-height: 40px; border-bottom: var(--rule-hair) solid var(--color-rule); font-size: var(--text-sm); }
    .line:last-child { border-bottom: 0; }
    .n { text-align: right; font-weight: 600; }
    @media (max-width: 60rem) { .pair { grid-template-columns: minmax(0, 1fr); } .nav { margin-left: 0; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stats {
  // The router binds the query param by its public name; the field name is taken by the derived value.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly kindParam = input<string>(undefined, { alias: 'kind' });
  readonly at = input<string>();
  private router = inject(Router);
  readonly now = today();
  readonly kind = computed<Period>(() => (this.kindParam() === 'month' ? 'month' : 'week'));
  readonly anchor = computed(() => (/^\d{4}-\d{2}-\d{2}$/.test(this.at() ?? '') && this.at()! <= this.now ? this.at()! : this.now));
  readonly range = computed(() => periodRange(this.kind(), this.anchor()));
  readonly prevFrom = computed(() => shiftPeriod(this.kind(), this.anchor(), -1));
  readonly current = computed(() => this.range()[0] <= this.now && this.now <= this.range()[1]);

  private doneRows = liveRows<Task>('tasks', () => { const [f, t] = [this.prevFrom(), this.range()[1]]; return (q) => q.gte('completed_day', f).lte('completed_day', t); });
  private dueRows = liveRows<Task>('tasks', () => { const [f, t] = [this.prevFrom(), this.range()[1]]; return (q) => q.gte('due_date', f).lte('due_date', t); });
  private projectRows = liveRows<Project>('projects');
  private reportRows = liveRows<Report>('daily_reports', () => { const [f, t] = this.range(); return (q) => q.gte('day', f).lte('day', t); });
  private first = liveRows<Report>('daily_reports', () => (q) => q.order('day').limit(1));
  // The streak runs back from today whatever period is shown (ponytail: caps at 120 days).
  private recent = liveRows<Report>('daily_reports', () => (q) => q.gte('day', addDays(this.now, -120)).lte('day', this.now));
  readonly loaded = this.doneRows.loaded;

  private rows = computed(() => uniqueById(this.doneRows.rows(), this.dueRows.rows()));
  readonly days = computed(() => daysIn(...this.range()));
  readonly st = computed(() => periodStats(this.rows(), this.days(), this.projectRows.rows(), this.now));
  private elapsed = computed(() => this.days().filter((d) => d <= this.now).length);
  // The running period is compared with the same number of days of the one before, not all of it.
  readonly prev = computed(() => {
    const [, prevTo] = periodRange(this.kind(), this.prevFrom());
    return periodStats(this.rows(), daysIn(this.prevFrom(), prevTo).slice(0, this.current() ? this.elapsed() : undefined), this.projectRows.rows(), this.now);
  });
  readonly diff = computed(() => this.st().done - this.prev().done);
  readonly rep = computed(() => reportStats(this.days().filter((d) => d <= this.now), this.reportRows.rows(), this.first.rows()[0]?.day ?? null));
  readonly streak = computed(() => reportStats([], this.recent.rows(), null).ontimeStreak);
  readonly counts = computed(() => Object.fromEntries(this.days().map((d, i) => [d, this.st().perDay[i]])));
  readonly missed = computed(() => new Set(this.days().filter((d) => dayCounts(this.rows(), d, this.now).missed > 0)));
  readonly unit = computed(() => (this.kind() === 'week' ? tr('tuần trước') : tr('tháng trước')));
  private past = computed(() => this.days().slice(0, this.elapsed()));
  readonly best = computed(() => this.past().reduce<string | null>((b, d, i) => (this.st().perDay[i] > (b ? this.counts()[b] : 0) ? d : b), null));
  readonly activeDays = computed(() => this.past().filter((d) => this.counts()[d] > 0).length);
  readonly elapsedN = this.elapsed;
  readonly avg = computed(() => (this.elapsed() ? (this.st().done / this.elapsed()).toFixed(1).replace('.', ',') : '0'));
  readonly periodName = computed(() => {
    const [f, t] = this.range();
    return this.kind() === 'week' ? tr('Tuần {from} – {to}', { from: fmtDay(f), to: fmtDay(t) }) : tr('Tháng {m}, {y}', { m: Number(f.slice(5, 7)), y: f.slice(0, 4) });
  });
  readonly byProject = computed(() => this.st().byProject.map((g) => ({ label: g.id ? g.name : tr(g.name), n: g.n })));
  readonly byTag = computed(() => this.st().byTag.map(([tag, n]) => ({ label: `#${tag}`, n })));
  pct = pct;
  fmtDay = fmtDay;
  max(items: { n: number }[]) {
    return Math.max(1, ...items.map((i) => i.n));
  }

  go(kind: Period, at: string | null) {
    this.router.navigate([], { queryParams: { kind: kind === 'week' ? null : kind, at: at === this.now ? null : at }, replaceUrl: true });
  }
  step(n: number) {
    this.go(this.kind(), shiftPeriod(this.kind(), this.anchor(), n));
  }
}
