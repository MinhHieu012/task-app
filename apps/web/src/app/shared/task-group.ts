import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import type { Project, Subtask, Task } from '@core/types';

import { liveRows } from '../core/live';
import { TrPipe } from '../core/prefs.service';
import { openTaskId } from '../core/ui.service';
import { Icon } from './icon';
import { TaskRow } from './task-row';

/** A heading with its count, then the tasks as lines on one sheet; skeleton lines while loading. Loads the
 *  subtasks of its tasks in one query. `foldable`: starts folded (done tasks), the heading opens it. */
@Component({
  selector: 'app-task-group',
  imports: [TaskRow, TrPipe, Icon],
  template: `
    <section [attr.aria-labelledby]="headId">
      <div class="sheet-head">
        <h2 class="section-title" [id]="headId" [class.danger-text]="over()">
          @if (foldable()) {
            <button type="button" class="fold" (click)="folded.set(!folded())" [attr.aria-expanded]="!folded()">
              {{ title() }} <app-icon [name]="folded() ? 'chevron-down' : 'chevron-up'" [size]="16" />
            </button>
          } @else {
            {{ title() }}
          }
          @if (!loading()) { <span class="count num">{{ tasks().length }}</span> }
        </h2>
        <ng-content />
      </div>
      @if (!folded()) {
        <div class="sheet rows">
          @if (loading()) {
            @for (i of [0, 1, 2]; track i) {
              <div class="skel-row" aria-hidden="true"><span class="skeleton dot"></span><span class="grow stack-xs"><span class="skeleton" style="width: 55%; height: 14px"></span><span class="skeleton" style="width: 30%; height: 12px"></span></span></div>
            }
            <span class="visually-hidden" role="status">{{ 'Đang tải…' | tr }}</span>
          } @else {
            @for (t of tasks(); track t.id) {
              <app-task-row [task]="t" [project]="projectName(t)" [hideDate]="hideDate()" [timeCol]="timeCol()" [compact]="compact()" [subs]="subsOf(t.id)" [selected]="openId() === t.id" />
            } @empty {
              @if (empty()) { <p class="empty-line">{{ empty() }}</p> }
            }
          }
        </div>
      }
    </section>
  `,
  styles: `
    .rows { overflow: hidden; }
    .count { margin-left: 8px; font-size: var(--text-sm); font-weight: 500; color: var(--color-muted); }
    .fold { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--radius-sm); }
    .fold:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .skel-row { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-bottom: var(--rule-hair) solid var(--color-rule); }
    .skel-row:last-of-type { border-bottom: 0; }
    .dot { width: 24px; height: 24px; border-radius: 50%; }
    .stack-xs { display: flex; flex-direction: column; gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskGroup {
  private static n = 0;
  readonly headId = `tg-${++TaskGroup.n}`;
  readonly title = input.required<string>();
  readonly tasks = input<Task[]>([]);
  /** Shows each task's project when given. */
  readonly projects = input<Project[]>();
  readonly over = input(false);
  readonly hideDate = input(false);
  readonly timeCol = input(false);
  readonly compact = input(false);
  readonly loading = input(false);
  readonly empty = input('');
  readonly foldable = input(false);
  readonly folded = linkedSignal(() => this.foldable());
  readonly openId = openTaskId();

  // Same ids, same query: a refetch of the tasks must not refetch their subtasks too.
  private ids = computed(() => this.tasks().map((t) => t.id), { equal: (a, b) => a.join() === b.join() });
  private subtasks = liveRows<Subtask>('subtasks', () => {
    const ids = this.ids();
    return ids.length ? (q) => q.in('task_id', ids).order('created_at') : null;
  });
  private names = computed(() => (this.projects() ? new Map(this.projects()!.map((p) => [p.id, p.name])) : null));

  projectName(t: Task) {
    const names = this.names();
    return names ? (t.project_id ? (names.get(t.project_id) ?? '') : '') : undefined;
  }
  subsOf(id: string) {
    return this.subtasks.rows().filter((s) => s.task_id === id);
  }
}
