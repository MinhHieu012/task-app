import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { addDays, fmtDay, localDay, nextMonday, today } from '@core/dates';
import { htmlToText } from '@core/html';
import { tr } from '@core/i18n';
import { fmtSpan, spanLength, subStatus } from '@core/subtasks';
import { dayName, daysBetween, endDay, priorityLabel, repeatLabel, timeRange } from '@core/tasks';
import type { Subtask, Task } from '@core/types';

import { TrPipe } from '../core/prefs.service';
import { TasksService } from '../core/tasks.service';
import { UiService } from '../core/ui.service';
import { Icon } from './icon';
import { Tick } from './tick';

/** One task as a line on its group's sheet (the ledger). `timeCol`: Today's left column with the start or the
 *  lateness. `compact`: narrow columns (Upcoming), no priority column. Tags, the subtask toggle and the snooze
 *  buttons are their own targets inside the row; the rest of the row opens the task. */
@Component({
  selector: 'app-task-row',
  imports: [Icon, Tick, TrPipe, RouterLink],
  templateUrl: './task-row.html',
  styleUrl: './task-row.scss',
  host: { '[class.selected]': 'selected()', '[class.done]': 'done()', '[class.compact]': 'compact()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskRow {
  readonly task = input.required<Task>();
  /** undefined: don't show the project; '' : the Inbox. */
  readonly project = input<string>();
  readonly hideDate = input(false);
  readonly timeCol = input(false);
  readonly compact = input(false);
  readonly subs = input<Subtask[]>([]);
  readonly selected = input(false);

  private tasks = inject(TasksService);
  private ui = inject(UiService);
  readonly busy = signal(false);
  readonly open = signal(false);
  readonly optimistic = signal<Record<string, boolean>>({});

  readonly day = today();
  readonly done = computed(() => !!this.task().completed_at);
  readonly last = computed(() => endDay(this.task()));
  readonly over = computed(() => !this.done() && !!this.last() && this.last()! < this.day);
  readonly late = computed(() => (this.over() ? tr('Trễ {n} ngày', { n: daysBetween(this.last()!, this.day) }) : ''));
  readonly range = computed(() => timeRange(this.task()));
  readonly due = computed(() => {
    const t = this.task();
    return t.due_date ? [dayName(t.due_date), this.range()].filter(Boolean).join(', ') : '';
  });
  readonly note = computed(() => (this.task().note ? htmlToText(this.task().note!) : ''));
  readonly repeat = computed(() => {
    const t = this.task();
    return t.repeat || t.recurring_copy ? (!this.done() && t.repeat ? repeatLabel(t.repeat) : tr('Lặp lại')) : '';
  });
  readonly doneAt = computed(() => (this.task().completed_at ? new Date(this.task().completed_at!).toTimeString().slice(0, 5) : ''));
  readonly snooze = computed(() => !this.done() && !!this.task().due_date && this.task().due_date! <= this.day);
  readonly subsDone = computed(() => this.subs().filter((s) => this.subDone(s)).length);
  readonly priorityName = computed(() => priorityLabel(this.task().priority));
  readonly fmtDay = fmtDay;

  subDone(s: Subtask) {
    return this.optimistic()[s.id] ?? s.done;
  }
  subSpan = fmtSpan;
  subLength = spanLength;
  subState(s: Subtask) {
    const d = new Date();
    return subStatus({ ...s, done: this.subDone(s) }, `${localDay(d)} ${d.toTimeString().slice(0, 5)}`);
  }

  openTask() {
    this.ui.openTask(this.task().id);
  }

  async tick() {
    this.busy.set(true);
    await this.tasks.toggleDone(this.task());
    this.busy.set(false);
  }

  async push(which: 'tomorrow' | 'monday') {
    const [to, said] = which === 'tomorrow' ? [addDays(this.day, 1), tr('ngày mai')] : [nextMonday(this.day), tr('thứ Hai tuần sau')];
    this.busy.set(true);
    await this.tasks.move([this.task()], () => to, tr('Đã dời việc'), tr('“{name}” chuyển sang {day}.', { name: this.task().title, day: said }));
    this.busy.set(false);
  }

  async tickSub(s: Subtask) {
    const next = !this.subDone(s);
    this.optimistic.update((o) => ({ ...o, [s.id]: next }));
    const ok = await this.tasks.updateSubtask(s.id, { done: next });
    // On success the refetched row agrees with the optimistic value, so it can stay; on failure it goes.
    if (!ok) this.optimistic.update(({ [s.id]: _, ...rest }) => rest);
  }
}
