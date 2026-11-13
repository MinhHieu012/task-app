import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { fmtDate, localDay, today } from '@core/dates';
import { tr } from '@core/i18n';
import { groupByProject } from '@core/journal';
import { DEADLINE, draftHtml, isLate, reportStatus } from '@core/reports';
import { uniqueById } from '@core/tasks';
import type { Project, Report, Subtask, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { NotifyService } from '../../core/notify.service';
import { TrPipe } from '../../core/prefs.service';
import { TasksService } from '../../core/tasks.service';
import { Icon } from '../../shared/icon';
import { ReportBadge, timeOf } from '../../shared/report-bits';
import { RichEditor } from '../../shared/rich-editor';

/** Write or edit one day's report. A new report starts from a draft of the day's journal (done tasks by project
 *  with their subtasks, what slipped, empty sections). Past the day's deadline it can still be edited, never deleted. */
@Component({
  selector: 'app-report',
  imports: [RouterLink, TrPipe, Icon, RichEditor, ReportBadge],
  templateUrl: './report.html',
  styles: `
    .status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .warn { display: flex; gap: 10px; padding: 12px 14px; border-radius: var(--radius-ctl); background: var(--color-warning-wash); color: var(--color-ink); font-size: var(--text-sm); }
    .warn app-icon { color: var(--color-warning); }
    .actions { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .grp { padding: 10px 0; border-bottom: var(--rule-hair) solid var(--color-rule); }
    .grp:last-child { border-bottom: 0; }
    .item { display: flex; gap: 8px; font-size: var(--text-sm); padding: 3px 0; }
    .item app-icon { margin-top: 3px; color: var(--color-success); }
    .item.open app-icon { color: var(--color-muted); }
    .back { display: inline-flex; align-items: center; gap: 2px; text-decoration: none; margin-bottom: 6px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportPage {
  readonly day = input.required<string>();
  private tasks = inject(TasksService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  readonly deadline = DEADLINE;
  readonly valid = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(this.day()) && this.day() <= today());

  private reports = liveRows<Report>('daily_reports', () => { const d = this.day(); return (q) => q.eq('day', d); });
  private doneRows = liveRows<Task>('tasks', () => { const d = this.day(); return (q) => q.eq('completed_day', d); });
  private dueRows = liveRows<Task>('tasks', () => { const d = this.day(); return (q) => q.eq('due_date', d); });
  private projectRows = liveRows<Project>('projects');
  private ids = computed(() => uniqueById(this.doneRows.rows(), this.dueRows.rows()).map((t) => t.id), { equal: (a, b) => a.join() === b.join() });
  private subRows = liveRows<Subtask>('subtasks', () => { const ids = this.ids(); return ids.length ? (q) => q.in('task_id', ids).order('created_at') : null; });
  readonly ready = computed(() => this.reports.loaded() && this.doneRows.loaded() && this.dueRows.loaded() && this.projectRows.loaded() && this.subRows.loaded());

  readonly report = computed(() => this.reports.rows().find((r) => r.day === this.day()));
  readonly done = this.doneRows.rows;
  readonly open = computed(() => this.dueRows.rows().filter((t) => !t.completed_day || t.completed_day > this.day()));
  readonly groups = computed(() => groupByProject(this.done(), this.projectRows.rows()).map((g) => ({ ...g, name: g.id ? g.name : tr(g.name) })));
  /** Built once, when the data is in, so later realtime reloads don't reset the editor. */
  readonly initial = linkedSignal<{ ready: boolean; day: string }, string | null>({
    source: () => ({ ready: this.ready(), day: this.day() }),
    computation: (s, prev) => {
      if (prev?.value != null && prev.source.day === s.day) return prev.value;
      if (!s.ready) return null;
      return this.report()?.content ?? draftHtml(this.groups(), this.open(), this.subRows.rows());
    },
  });
  readonly status = computed(() => reportStatus(this.day(), this.report(), this.day()));
  readonly locked = computed(() => isLate(this.day(), new Date()));
  readonly edited = computed(() => {
    const r = this.report();
    return r && +new Date(r.updated_at) - +new Date(r.submitted_at) > 60_000;
  });
  readonly busy = signal(false);
  private content = { html: '', text: '' };
  fmtDate = fmtDate;
  timeOf = timeOf;
  dateOf = (at: string) => fmtDate(localDay(new Date(at)));
  missedPast = computed(() => this.day() < today() && this.open().length > 0);

  setContent(e: { html: string; text: string }) {
    this.content = e;
  }

  async save() {
    if (!this.content.text.trim()) return this.notify.toast(tr('Viết vài dòng trước khi nộp.'), tr('Báo cáo đang trống'), 'error');
    this.busy.set(true);
    const ok = await this.tasks.saveReport(this.day(), this.content.html, this.content.text, this.report(), this.done(), this.dueRows.rows());
    this.busy.set(false);
    if (ok) this.router.navigateByUrl('/reports');
  }

  async remove() {
    const r = this.report();
    if (!r || this.locked()) return;
    const date = fmtDate(this.day());
    if (!(await this.notify.confirm(tr('Xoá báo cáo ngày {date}?', { date }), tr('Báo cáo sẽ bị xoá vĩnh viễn. Bạn vẫn viết lại được trước {time}.', { time: DEADLINE })))) return;
    if (!(await this.tasks.removeReport(r))) return;
    this.notify.toast(tr('Đã xoá báo cáo ngày {date}.', { date }), tr('Đã xoá'), 'success');
    this.router.navigateByUrl('/reports');
  }
}
