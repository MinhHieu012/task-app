import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { addDays, fmtDay, fromIso, today, toIso } from '@core/dates';
import { tr } from '@core/i18n';
import { dayCounts, groupByProject, monthCounts } from '@core/journal';
import { reportStats, reportStatus, type Status } from '@core/reports';
import { uniqueById } from '@core/tasks';
import type { JournalNote, Project, Report, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { TrPipe } from '../../core/prefs.service';
import { TasksService } from '../../core/tasks.service';
import { UiService, useQuickAdd } from '../../core/ui.service';
import { Calendar, dayForMonth, monthOf } from '../../shared/calendar';
import { DayChart } from '../../shared/day-chart';
import { Icon } from '../../shared/icon';
import { ReportCard } from '../../shared/report-bits';
import { TaskGroup } from '../../shared/task-group';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** The month's record: figures, done per day, a calendar on the left and the selected day (its report, free note
 *  and done tasks by project) on the right. The selected day is in the URL (?day). The quick add logs work done. */
@Component({
  selector: 'app-journal',
  imports: [FormsModule, RouterLink, TrPipe, Icon, Calendar, DayChart, ReportCard, TaskGroup],
  templateUrl: './journal.html',
  styleUrl: './journal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Journal {
  // The router binds the query param by its public name; the field name is taken by the derived value.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly dayParam = input<string>(undefined, { alias: 'day' });
  private router = inject(Router);
  private tasks = inject(TasksService);
  readonly ui = inject(UiService);
  readonly now = today();
  readonly day = computed(() => (/^\d{4}-\d{2}-\d{2}$/.test(this.dayParam() ?? '') && this.dayParam()! <= this.now ? this.dayParam()! : this.now));
  readonly ym = computed(() => monthOf(this.day()));
  private from = computed(() => toIso(new Date(this.ym().year, this.ym().month - 1, 1)));
  private to = computed(() => toIso(new Date(this.ym().year, this.ym().month, 0)));

  // Done entries of the month and tasks due in it (missed counts), the month's reports plus 120 days for the streak.
  private doneRows = liveRows<Task>('tasks', () => { const [f, t] = [this.from(), this.to()]; return (q) => q.gte('completed_day', f).lte('completed_day', t); });
  private dueRows = liveRows<Task>('tasks', () => { const [f, t] = [this.from(), this.to()]; return (q) => q.gte('due_date', f).lte('due_date', t); });
  private projectRows = liveRows<Project>('projects');
  private reportRows = liveRows<Report>('daily_reports', () => {
    const recent = addDays(this.now, -120);
    const [f, t] = [this.from(), this.to()];
    return (q) => q.gte('day', f < recent ? f : recent).lte('day', t);
  });
  // The first report ever: days before it are not counted as missing.
  private first = liveRows<Report>('daily_reports', () => (q) => q.order('day').limit(1));

  readonly loaded = this.doneRows.loaded;
  private rows = computed(() => uniqueById(this.doneRows.rows(), this.dueRows.rows()));
  readonly counts = computed(() => monthCounts(this.rows(), this.ym().year, this.ym().month));
  readonly missed = computed(() => new Set(Object.keys(this.counts()).filter((d) => dayCounts(this.rows(), d).missed > 0)));
  readonly dayFig = computed(() => dayCounts(this.rows(), this.day()));
  readonly groups = computed(() => groupByProject(this.doneRows.rows().filter((t) => t.completed_day === this.day()), this.projectRows.rows()));
  private since = computed(() => this.first.rows()[0]?.day ?? null);
  private byDay = computed(() => new Map(this.reportRows.rows().map((r) => [r.day, r])));
  readonly statuses = computed<Record<string, Status>>(() => Object.fromEntries(Object.keys(this.counts()).map((d) => [d, reportStatus(d, this.byDay().get(d), this.since())])));
  readonly report = computed(() => this.byDay().get(this.day()));

  // Month figures: only days up to today count.
  private pastDays = computed(() => Object.keys(this.counts()).sort().filter((d) => d <= this.now));
  readonly dayCount = computed(() => this.pastDays().length);
  readonly total = computed(() => this.pastDays().reduce((s, d) => s + this.counts()[d], 0));
  readonly active = computed(() => this.pastDays().filter((d) => this.counts()[d] > 0).length);
  readonly best = computed(() => this.pastDays().reduce<string | null>((b, d) => (this.counts()[d] > (b ? this.counts()[b] : 0) ? d : b), null));
  readonly lastMissed = computed(() => [...this.missed()].sort().at(-1));
  readonly rep = computed(() => reportStats(this.pastDays(), this.reportRows.rows(), this.since()));
  readonly avg = computed(() => (this.pastDays().length ? (this.total() / this.pastDays().length).toFixed(1).replace('.', ',') : '0'));
  readonly isToday = computed(() => this.day() === this.now);
  readonly label = computed(() => `${this.day().slice(8)}/${this.day().slice(5, 7)}`);
  readonly title = computed(() => `${this.isToday() ? tr('Hôm nay') : tr(WEEKDAY[fromIso(this.day()).getDay()])}, ${this.label()}`);

  // The day's free note: a draft per day, null while showing what is saved.
  private noteRows = liveRows<JournalNote>('journal_notes', () => { const d = this.day(); return (q) => q.eq('day', d); });
  readonly noteLoaded = this.noteRows.loaded;
  readonly saved = computed(() => this.noteRows.rows()[0]?.body ?? '');
  readonly draft = signal<string | null>(null);
  readonly noteBusy = signal(false);
  readonly dirty = computed(() => this.draft() !== null && this.draft()!.trim() !== this.saved());

  fmtDay = fmtDay;
  statusOf = (d: string): Status => this.statuses()[d] ?? 'none';

  constructor() {
    effect(() => { this.day(); this.draft.set(null); });
    useQuickAdd(() => {
      const day = this.day();
      const isToday = this.isToday();
      return {
        // Today: now. Another day: 12:00 local of that day.
        defaults: () => {
          const at = isToday ? new Date() : new Date(fromIso(day).setHours(12));
          return { completed_at: at.toISOString(), completed_day: day, due_date: day, due_time: at.toTimeString().slice(0, 5) };
        },
        placeholder: isToday ? ['Ghi việc đã làm hôm nay…'] : ['Ghi việc đã làm ngày {day}…', { day: this.label() }],
        label: tr('Ghi việc đã làm'),
      };
    });
  }

  select(d: string) {
    this.router.navigate([], { queryParams: { day: d === this.now ? null : d }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  shiftMonth(delta: number) {
    this.select(dayForMonth(this.ym().year, this.ym().month + delta));
  }
  groupName(g: { id: string | null; name: string }) {
    return g.id ? g.name : tr(g.name);
  }

  async saveNote() {
    this.noteBusy.set(true);
    if (await this.tasks.saveNote(this.day(), this.draft()!.trim())) this.draft.set(null);
    this.noteBusy.set(false);
  }
}
