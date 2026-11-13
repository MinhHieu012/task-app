import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { addDays, fmtDay, fromIso, today } from '@core/dates';
import { tr } from '@core/i18n';
import { reportStats, reportStatus } from '@core/reports';
import { daysBetween, endDay } from '@core/tasks';
import type { Project, Report, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { TrPipe } from '../../core/prefs.service';
import { TasksService } from '../../core/tasks.service';
import { UiService, useQuickAdd } from '../../core/ui.service';
import { Icon } from '../../shared/icon';
import { ReportNudge } from '../../shared/report-bits';
import { TaskGroup } from '../../shared/task-group';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

@Component({
  selector: 'app-today',
  imports: [TrPipe, Icon, RouterLink, TaskGroup, ReportNudge],
  templateUrl: './today.html',
  styleUrl: './today.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Today {
  private tasks = inject(TasksService);
  readonly ui = inject(UiService);
  readonly day = today();
  readonly title = `${tr(WEEKDAY[fromIso(this.day).getDay()])}, ${fmtDay(this.day)}`;
  private past = Array.from({ length: 7 }, (_, i) => addDays(this.day, i - 6)); // last 7 days, today last
  readonly week = Array.from({ length: 7 }, (_, i) => addDays(this.day, i + 1));

  private openRows = liveRows<Task>('tasks', () => (q) => q.is('completed_at', null).lte('due_date', this.day).order('due_date').order('due_time', { nullsFirst: false }).order('priority'));
  private recent = liveRows<Task>('tasks', () => (q) => q.gte('completed_day', this.past[0]).lte('completed_day', this.day).order('completed_at'));
  private soonRows = liveRows<Task>('tasks', () => (q) => q.is('completed_at', null).gt('due_date', this.day).lte('due_date', this.week[6]).order('due_date').order('due_time', { nullsFirst: false }));
  private projectRows = liveRows<Project>('projects');
  // Today's report and the days before it for the on-time streak (ponytail: a streak caps at 120 days).
  private reports = liveRows<Report>('daily_reports', () => (q) => q.gte('day', addDays(this.day, -120)).lte('day', this.day));

  readonly loaded = this.openRows.loaded;
  readonly projects = this.projectRows.rows;
  readonly over = computed(() => this.openRows.rows().filter((t) => endDay(t)! < this.day));
  // A task that started earlier but ends today or later is still on time.
  readonly due = computed(() => this.openRows.rows().filter((t) => endDay(t)! >= this.day));
  readonly done = computed(() => this.recent.rows().filter((t) => t.completed_day === this.day));
  readonly perDay = computed(() => this.past.map((d) => this.recent.rows().filter((t) => t.completed_day === d).length));
  readonly vsYesterday = computed(() => this.perDay()[6] - this.perDay()[5]);
  readonly maxBar = computed(() => Math.max(1, ...this.perDay()));
  readonly oldest = computed(() => (this.over().length ? Math.max(...this.over().map((t) => daysBetween(endDay(t)!, this.day))) : 0));
  readonly report = computed(() => this.reports.rows().find((r) => r.day === this.day));
  readonly reportLoaded = this.reports.loaded;
  readonly status = computed(() => reportStatus(this.day, this.report(), this.day));
  readonly streak = computed(() => reportStats([], this.reports.rows(), null).ontimeStreak);
  readonly soon = this.soonRows.rows;
  readonly next = computed(() => this.soon()[0]);
  readonly moving = signal(false);

  constructor() {
    useQuickAdd(() => ({ defaults: () => ({ due_date: this.day }), placeholder: ['Thêm việc cho hôm nay…'] }));
  }

  short = (d: string) => tr(SHORT[fromIso(d).getDay()]);
  weekday = (d: string) => tr(WEEKDAY[fromIso(d).getDay()]);
  fmtDay = fmtDay;
  countOn = (d: string) => this.soon().filter((t) => t.due_date === d).length;
  doneAt = (t: Task) => new Date(t.completed_at!).toTimeString().slice(0, 5);
  nextMeta = (t: Task) => [t.due_time?.slice(0, 5), this.projectOf(t)].filter(Boolean).join(', ');
  projectOf = (t: Task) => (t.project_id ? (this.projects().find((p) => p.id === t.project_id)?.name ?? '') : tr('Hộp thư'));

  async moveOverdue() {
    this.moving.set(true);
    const over = this.over();
    await this.tasks.move(over, () => this.day, tr('Đã dời việc quá hạn'), tr('{n} việc giờ có hạn hôm nay.', { n: over.length }));
    this.moving.set(false);
  }
}
