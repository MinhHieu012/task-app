import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { addDays, fmtDay, today } from '@core/dates';
import { DUE_LABEL, endDay, groupByDue } from '@core/tasks';
import type { Project, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { PrefsService, TrPipe } from '../../core/prefs.service';
import { TasksService } from '../../core/tasks.service';
import { Icon } from '../../shared/icon';
import { TaskGroup } from '../../shared/task-group';

/** Projects as one table (open, overdue, done this week, nearest due), a row to add one, then every open project
 *  task by deadline. On phones each row restacks as a labelled block. */
@Component({
  selector: 'app-projects',
  imports: [FormsModule, RouterLink, TrPipe, Icon, TaskGroup],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Projects {
  private tasks = inject(TasksService);
  private router = inject(Router);
  readonly prefs = inject(PrefsService);
  readonly day = today();
  readonly label = DUE_LABEL;
  readonly list = liveRows<Project>('projects', () => (q) => q.order('name'));
  private openRows = liveRows<Task>('tasks', () => (q) => q.is('completed_at', null).not('project_id', 'is', null).order('due_date', { nullsFirst: false }).order('priority'));
  private doneRows = liveRows<Task>('tasks', () => (q) => q.not('project_id', 'is', null).gte('completed_day', addDays(this.day, -6)));
  readonly name = signal('');
  readonly busy = signal(false);

  readonly open = this.openRows.rows;
  readonly byDue = computed(() => groupByDue(this.open(), this.day));
  readonly count = (k: string) => this.byDue().find(([g]) => g === k)?.[1].length ?? 0;
  readonly total = computed(() => this.open().length + this.doneRows.rows().length);
  readonly pct = computed(() => (this.total() ? Math.round((this.doneRows.rows().length / this.total()) * 100) : 0));
  readonly doneN = computed(() => this.doneRows.rows().length);
  readonly rows = computed(() =>
    this.list.rows().map((p, i) => {
      const mine = this.open().filter((t) => t.project_id === p.id);
      const done = this.doneRows.rows().filter((t) => t.project_id === p.id).length;
      const total = mine.length + done;
      return {
        p, color: this.prefs.projectColor(i), open: mine.length, done, total, frac: total ? done / total : 0,
        over: mine.filter((t) => t.due_date && endDay(t)! < this.day).length,
        next: mine.map((t) => t.due_date).filter((d): d is string => !!d && d >= this.day).sort()[0],
      };
    }));
  fmtDay = fmtDay;

  go(id: string) {
    this.router.navigate(['/project', id]);
  }

  async add() {
    if (!this.name().trim() || this.busy()) return;
    this.busy.set(true);
    if (await this.tasks.addProject(this.name())) this.name.set('');
    this.busy.set(false);
  }
}
