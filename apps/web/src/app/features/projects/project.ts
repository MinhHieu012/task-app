import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { addDays, fmtDay, today } from '@core/dates';
import { DUE_LABEL, endDay, groupByDue } from '@core/tasks';
import type { Project, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { PrefsService, TrPipe } from '../../core/prefs.service';
import { TasksService } from '../../core/tasks.service';
import { UiService, useQuickAdd } from '../../core/ui.service';
import { Icon } from '../../shared/icon';
import { TaskGroup } from '../../shared/task-group';

/** One project: its open tasks by deadline and what was done this week; rename and delete in the head. */
@Component({
  selector: 'app-project',
  imports: [FormsModule, RouterLink, TrPipe, Icon, TaskGroup],
  template: `
    <div class="page with-aside">
      <header class="page-head">
        @if (renaming()) {
          <form class="rename" (submit)="$event.preventDefault(); rename()">
            <label for="pn" class="visually-hidden">{{ 'Tên project' | tr }}</label>
            <input #nameInput id="pn" class="input" type="text" name="name" [ngModel]="name()" (ngModelChange)="name.set($event)" (keydown.escape)="renaming.set(false)" />
            <button type="button" class="btn btn-ghost" (click)="renaming.set(false)">{{ 'Huỷ' | tr }}</button>
            <button type="submit" class="btn btn-primary" [disabled]="!name().trim()">{{ 'Lưu' | tr }}</button>
          </form>
        } @else {
          <div class="grow">
            <a class="link back" routerLink="/projects"><app-icon name="chevron-left" [size]="14" />Project</a>
            <h1 class="title"><span class="mark" [style.background]="color()"></span>{{ project()?.name ?? (projects.loaded() ? ('Không tìm thấy project' | tr) : '') }}</h1>
            @if (rows.loaded() && project()) { <p class="meta">{{ '{open} việc đang mở, {done} đã xong tuần này' | tr: { open: open().length, done: done().length } }}</p> }
          </div>
          @if (project()) {
            <div class="row">
              <button type="button" class="btn" (click)="startRename()"><app-icon name="pencil" [size]="16" />{{ 'Đổi tên' | tr }}</button>
              <button type="button" class="btn btn-primary hide-narrow" (click)="ui.focusQuickAdd()"><app-icon name="plus" [size]="16" />{{ 'Thêm việc' | tr }}</button>
            </div>
          }
        }
      </header>

      <div class="page-main">
        @if (!rows.loaded()) {
          <app-task-group [title]="'Việc' | tr" [loading]="true" />
        } @else if (projects.loaded() && !project()) {
          <div class="sheet empty"><h2>{{ 'Không tìm thấy project' | tr }}</h2><p>{{ 'Project này đã bị xoá hoặc không thuộc tài khoản của bạn.' | tr }}</p>
            <div class="actions"><a class="btn" routerLink="/projects">{{ 'Về danh sách project' | tr }}</a></div></div>
        } @else if (!open().length && !done().length) {
          <div class="sheet empty">
            <app-icon name="folder-open" [size]="28" />
            <h2>{{ 'Project này chưa có việc' | tr }}</h2>
            <p>{{ 'Thêm việc đầu tiên, hoặc chuyển việc từ Hộp thư vào đây.' | tr }}</p>
            <div class="actions"><button type="button" class="btn" (click)="ui.focusQuickAdd()"><app-icon name="plus" [size]="16" />{{ 'Thêm việc' | tr }}</button></div>
          </div>
        } @else {
          @for (g of byDue(); track g[0]) { <app-task-group [title]="label[g[0]] | tr" [tasks]="g[1]" [over]="g[0] === 'over'" /> }
          @if (done().length) { <app-task-group [title]="'Đã xong tuần này' | tr" [tasks]="done()" [foldable]="true" /> }
        }
      </div>

      @if (project()) {
        <aside class="page-aside">
          <section aria-labelledby="pw">
            <div class="sheet-head"><h2 id="pw" class="section-title">{{ 'Tiến độ tuần này' | tr }}</h2></div>
            <p class="pct num">{{ pct() }}%</p>
            <p class="meta">{{ '{done}/{total} việc đã xong' | tr: { done: done().length, total: open().length + done().length } }}</p>
            <span class="track big"><span [style.background]="color()" [style.transform]="'scaleX(' + pct() / 100 + ')'"></span></span>
          </section>
          <section aria-labelledby="pd">
            <div class="sheet-head"><h2 id="pd" class="section-title">{{ 'Theo hạn' | tr }}</h2></div>
            <div class="info-line"><app-icon name="alert" />{{ 'Quá hạn' | tr }}<span class="n" [class.danger-text]="count('over')">{{ count('over') }}</span></div>
            <div class="info-line"><app-icon name="sun" />{{ 'Hôm nay' | tr }}<span class="n">{{ count('today') }}</span></div>
            <div class="info-line"><app-icon name="calendar" />{{ 'Sắp tới' | tr }}<span class="n">{{ count('soon') }}</span></div>
            <div class="info-line"><app-icon name="help" />{{ 'Chưa hẹn ngày' | tr }}<span class="n">{{ count('none') }}</span></div>
          </section>
          <section aria-labelledby="pu">
            <div class="sheet-head"><h2 id="pu" class="section-title">{{ 'Hạn sắp tới' | tr }}</h2></div>
            @for (t of upcoming(); track t.id) {
              <button type="button" class="info-line next" (click)="ui.openTask(t.id)"><span class="grow clamp-1">{{ t.title }}</span><span class="n">{{ t.due_date === day ? ('Hôm nay' | tr) : fmtDay(t.due_date!) }}</span></button>
            } @empty { <p class="meta">{{ 'Không có việc nào sắp đến hạn.' | tr }}</p> }
          </section>
          <button type="button" class="btn btn-danger" (click)="remove()"><app-icon name="trash" [size]="16" />{{ 'Xoá project' | tr }}</button>
        </aside>
      }
    </div>
  `,
  styles: `
    .back { display: inline-flex; align-items: center; gap: 2px; text-decoration: none; margin-bottom: 6px; }
    .title { display: flex; align-items: center; gap: 12px; }
    .mark { width: 14px; height: 14px; border-radius: 4px; flex: none; }
    .rename { display: flex; gap: 8px; width: 100%; max-width: 640px; .input { flex: 1; font-size: var(--text-lg); } }
    .empty > app-icon { color: var(--color-accent); }
    .pct { font-size: var(--text-3xl); font-weight: 600; margin-top: 8px; }
    .big { display: block; margin-top: 12px; height: 8px; }
    .next { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 12px; min-height: 44px; border-bottom: var(--rule-hair) solid var(--color-rule); font-size: var(--text-sm); cursor: pointer; }
    .next:hover { color: var(--color-accent); }
    .next:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
    .page-aside > .btn-danger { align-self: flex-start; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectPage {
  readonly id = input.required<string>();
  private tasks = inject(TasksService);
  private router = inject(Router);
  private prefs = inject(PrefsService);
  readonly ui = inject(UiService);
  readonly day = today();
  readonly label = DUE_LABEL;
  readonly projects = liveRows<Project>('projects', () => (q) => q.order('name'));
  readonly rows = liveRows<Task>('tasks', () => {
    const id = this.id();
    return (q) => q.is('completed_at', null).eq('project_id', id).order('due_date', { nullsFirst: false }).order('due_time', { nullsFirst: false }).order('priority');
  });
  private doneRows = liveRows<Task>('tasks', () => {
    const id = this.id();
    return (q) => q.eq('project_id', id).gte('completed_day', addDays(this.day, -6)).order('completed_at', { ascending: false });
  });
  private index = computed(() => this.projects.rows().findIndex((p) => p.id === this.id()));
  readonly project = computed<Project | undefined>(() => this.projects.rows()[this.index()]);
  readonly color = computed(() => this.prefs.projectColor(this.index()));
  readonly open = this.rows.rows;
  readonly done = this.doneRows.rows;
  readonly byDue = computed(() => groupByDue(this.open(), this.day));
  readonly count = (k: string) => this.byDue().find(([g]) => g === k)?.[1].length ?? 0;
  readonly pct = computed(() => {
    const total = this.open().length + this.done().length;
    return total ? Math.round((this.done().length / total) * 100) : 0;
  });
  readonly upcoming = computed(() => this.open().filter((t) => t.due_date && endDay(t)! >= this.day).slice(0, 5));
  readonly renaming = signal(false);
  readonly name = signal('');
  private nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  fmtDay = fmtDay;

  constructor() {
    useQuickAdd(() => ({ defaults: () => ({ project_id: this.id() }), placeholder: ['Thêm việc vào {name}…', { name: this.project()?.name ?? 'project' }] }));
  }

  startRename() {
    this.name.set(this.project()!.name);
    this.renaming.set(true);
    setTimeout(() => this.nameInput()?.nativeElement.select()); // after the field renders
  }
  async rename() {
    if (!this.name().trim()) return;
    if (await this.tasks.renameProject(this.id(), this.name())) this.renaming.set(false);
  }
  async remove() {
    if (await this.tasks.removeProject(this.project()!)) this.router.navigateByUrl('/projects');
  }
}
