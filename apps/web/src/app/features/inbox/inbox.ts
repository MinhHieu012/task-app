import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { today } from '@core/dates';
import { DUE_LABEL, endDay, groupByDue } from '@core/tasks';
import type { Project, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { PrefsService, TrPipe } from '../../core/prefs.service';
import { UiService } from '../../core/ui.service';
import { Icon } from '../../shared/icon';
import { TaskGroup } from '../../shared/task-group';

/** Tasks without a project, by deadline; the aside sums them up and lists the projects to file them into. */
@Component({
  selector: 'app-inbox',
  imports: [TrPipe, Icon, RouterLink, TaskGroup],
  template: `
    <div class="page with-aside">
      <header class="page-head">
        <div>
          <h1>{{ 'Hộp thư' | tr }}</h1>
          <p class="meta">{{ 'Việc chưa thuộc project nào' | tr }}@if (rows.loaded()) {<span>{{ ', {n} việc' | tr: { n: open().length } }}</span>}</p>
        </div>
        <button type="button" class="btn btn-primary hide-narrow" (click)="ui.focusQuickAdd()"><app-icon name="plus" [size]="16" />{{ 'Thêm việc' | tr }}</button>
      </header>
      <div class="page-main">
        @if (!rows.loaded()) {
          <app-task-group [title]="'Việc' | tr" [loading]="true" />
        } @else if (!open().length) {
          <div class="sheet empty">
            <h2>{{ 'Hộp thư trống' | tr }}</h2>
            <p>{{ 'Việc thêm nhanh mà chưa chọn project sẽ nằm ở đây cho tới khi bạn xếp nó vào project.' | tr }}</p>
            <div class="actions"><button type="button" class="btn" (click)="ui.focusQuickAdd()"><app-icon name="plus" [size]="16" />{{ 'Thêm việc' | tr }}</button></div>
          </div>
        } @else {
          @for (g of groups(); track g[0]) {
            <app-task-group [title]="label[g[0]] | tr" [tasks]="g[1]" [over]="g[0] === 'over'" />
          }
        }
      </div>
      <aside class="page-aside">
        <section aria-labelledby="ov">
          <div class="sheet-head"><h2 id="ov" class="section-title">{{ 'Tổng quan' | tr }}</h2></div>
          <div class="info-line"><app-icon name="inbox" />{{ 'Trong Hộp thư' | tr }}<span class="n">{{ open().length }}</span></div>
          <div class="info-line"><app-icon name="alert" />{{ 'Quá hạn' | tr }}<span class="n" [class.danger-text]="overN()">{{ overN() }}</span></div>
          <div class="info-line"><app-icon name="sun" />{{ 'Có hạn hôm nay' | tr }}<span class="n">{{ todayN() }}</span></div>
          <div class="info-line"><app-icon name="help" />{{ 'Chưa hẹn ngày' | tr }}<span class="n">{{ undated() }}</span></div>
        </section>
        <section aria-labelledby="pj">
          <div class="sheet-head"><h2 id="pj" class="section-title">Project</h2><a class="link" routerLink="/projects">{{ 'Quản lý' | tr }}</a></div>
          <p class="meta hint-line">{{ 'Mở một việc rồi chọn project trong bảng sửa để chuyển việc ra khỏi Hộp thư.' | tr }}</p>
          @for (p of projects.rows(); track p.id; let i = $index) {
            <a class="info-line proj" [routerLink]="['/project', p.id]"><span class="mark" [style.background]="prefs.projectColor(i)"></span><span class="grow clamp-1">{{ p.name }}</span><span class="n">{{ inProject(p.id) }}</span></a>
          } @empty { <p class="meta">{{ 'Chưa có project nào.' | tr }}</p> }
        </section>
      </aside>
    </div>
  `,
  styles: `
    .hint-line { margin: 6px 0 8px; }
    .proj { text-decoration: none; color: var(--color-ink); border-radius: var(--radius-sm); transition: background-color var(--dur-micro) var(--ease-out); }
    .proj:hover { background: var(--color-hover); }
    .proj:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
    .mark { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inbox {
  readonly ui = inject(UiService);
  readonly prefs = inject(PrefsService);
  readonly day = today();
  readonly label = DUE_LABEL;
  readonly rows = liveRows<Task>('tasks', () => (q) =>
    q.is('completed_at', null).is('project_id', null).order('due_date', { nullsFirst: false }).order('due_time', { nullsFirst: false }).order('priority').order('created_at'));
  readonly projects = liveRows<Project>('projects', () => (q) => q.order('name'));
  private inProjects = liveRows<Task>('tasks', () => (q) => q.is('completed_at', null).not('project_id', 'is', null));
  readonly open = this.rows.rows;
  readonly groups = computed(() => groupByDue(this.open(), this.day));
  readonly overN = computed(() => this.open().filter((t) => t.due_date && endDay(t)! < this.day).length);
  readonly todayN = computed(() => this.open().filter((t) => t.due_date && t.due_date <= this.day && endDay(t)! >= this.day).length);
  readonly undated = computed(() => this.open().filter((t) => !t.due_date).length);
  inProject = (id: string) => this.inProjects.rows().filter((t) => t.project_id === id).length;
}
