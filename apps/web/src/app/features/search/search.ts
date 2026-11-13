import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { searchTasks, tagCounts } from '@core/tags';
import type { Project, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { TrPipe } from '../../core/prefs.service';
import { Icon } from '../../shared/icon';
import { TaskGroup } from '../../shared/task-group';

const DONE_SHOWN = 50;

/** Every task, open and done, searched on the device (accent- and case-insensitive); #tags filter. The query is
 *  in the URL (?q), so a tag link from a task row lands here filtered. */
@Component({
  selector: 'app-search',
  imports: [TrPipe, Icon, TaskGroup],
  template: `
    <div class="page narrow-page">
      <header class="page-head">
        <div>
          <h1>{{ 'Tìm kiếm' | tr }}</h1>
          @if (text().trim() && rows.loaded()) { <p class="meta" aria-live="polite">{{ '{n} việc khớp' | tr: { n: found().length } }}</p> }
        </div>
      </header>
      <div class="page-main">
        <form role="search" (submit)="$event.preventDefault()">
          <div class="input-wrap">
            <app-icon name="search" />
            <input class="input big" type="search" name="q" autocomplete="off" spellcheck="false" autocapitalize="none" [attr.aria-label]="'Tìm việc' | tr"
              [placeholder]="'Tìm việc, ghi chú hoặc #nhãn…' | tr" [value]="text()" (input)="type(box.value)" #box />
          </div>
        </form>
        @if (tags().length) {
          <div class="chips tags" role="group" [attr.aria-label]="'Lọc theo nhãn' | tr">
            @for (t of tags(); track t[0]) {
              <button type="button" class="chip" [attr.aria-pressed]="on().includes(t[0])" (click)="toggle(t[0])">#{{ t[0] }} <span class="num muted">{{ t[1] }}</span></button>
            }
          </div>
        }
        @if (!text().trim()) {
          <p class="sheet empty-line">{{ 'Gõ để tìm trong tên và ghi chú của mọi việc, kể cả việc đã xong. Thêm #nhãn để lọc theo nhãn.' | tr }}</p>
        } @else if (!rows.loaded()) {
          <app-task-group [title]="'Đang mở' | tr" [loading]="true" />
        } @else if (!found().length) {
          <p class="sheet empty-line">{{ 'Không có việc nào khớp “{q}”.' | tr: { q: text().trim() } }}</p>
        } @else {
          @if (open().length) { <app-task-group [title]="'Đang mở' | tr" [tasks]="open()" [projects]="projects.rows()" /> }
          @if (done().length) { <app-task-group [title]="'Đã xong' | tr" [tasks]="done().slice(0, shownDone)" [projects]="projects.rows()" /> }
          @if (done().length > shownDone) { <p class="meta">{{ 'Còn {n} việc đã xong cũ hơn. Gõ cụ thể hơn để thu hẹp.' | tr: { n: done().length - shownDone } }}</p> }
        }
      </div>
    </div>
  `,
  styles: `
    .narrow-page { max-width: 1040px; }
    .big { min-height: 48px; font-size: var(--text-lg); }
    .tags { max-height: 120px; overflow-y: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Search {
  readonly q = input<string>();
  private router = inject(Router);
  /** Typed text, reset whenever ?q changes (a tag link while this page is open). */
  readonly text = linkedSignal(() => this.q() ?? '');
  // ponytail: loads every task and searches on the device; move to a Postgres unaccent index past many thousands of rows.
  readonly rows = liveRows<Task>('tasks', () => (x) => x.order('created_at', { ascending: false }));
  readonly projects = liveRows<Project>('projects', () => (x) => x.order('name'));
  readonly found = computed(() => searchTasks(this.rows.rows(), this.text()));
  readonly open = computed(() => this.found().filter((t) => !t.completed_at));
  readonly done = computed(() => this.found().filter((t) => t.completed_at).sort((a, b) => b.completed_at!.localeCompare(a.completed_at!)));
  // Done copies of recurring tasks would count one task many times.
  readonly tags = computed(() => tagCounts(this.rows.rows().filter((t) => !t.recurring_copy)));
  private words = computed(() => this.text().trim().split(/\s+/).filter(Boolean));
  readonly on = computed(() => this.words().filter((w) => w.startsWith('#')).map((w) => w.slice(1).toLowerCase()));
  readonly shownDone = DONE_SHOWN;
  private timer?: ReturnType<typeof setTimeout>;

  type(v: string) {
    this.text.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.router.navigate([], { queryParams: { q: v.trim() ? v : null }, replaceUrl: true }), 300);
  }
  toggle(tag: string) {
    const w = this.words();
    this.type(this.on().includes(tag) ? w.filter((x) => x.toLowerCase() !== `#${tag}`).join(' ') : [...w, `#${tag}`].join(' ') + ' ');
  }
}
