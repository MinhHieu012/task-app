import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { dayTitle } from '@core/dates';
import { tr } from '@core/i18n';
import { EXAMPLES as X, parseQuick } from '@core/quick';
import { completeTag, suggestTags, tagCounts } from '@core/tags';
import type { Task } from '@core/types';

import { liveRows } from '../core/live';
import { TrPipe } from '../core/prefs.service';
import { TasksService } from '../core/tasks.service';
import { UiService } from '../core/ui.service';
import { Icon, type IconName } from './icon';

/** The one quick add box (top bar on wide screens, the add sheet on phones). Enter saves; the text clears only
 *  after a successful insert. Typed syntax (mai, thứ 6, 20/11, 9h, !1, #nhãn) sets date, time, priority and
 *  tags; the panel shows what it understood and the syntax not used yet as chips that type it in. */
@Component({
  selector: 'app-quick-add',
  imports: [Icon, TrPipe],
  templateUrl: './quick-add.html',
  styleUrl: './quick-add.scss',
  host: { '[class.sheet-mode]': 'sheetMode()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickAdd {
  /** In the phone sheet the panel sits under the box instead of floating. */
  readonly sheetMode = input(false);
  readonly added = output();
  private tasks = inject(TasksService);
  readonly ui = inject(UiService);
  private input = viewChild.required<ElementRef<HTMLInputElement>>('box');

  readonly text = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly focused = signal(false);
  readonly count = signal(0);
  private blur?: ReturnType<typeof setTimeout>;

  // Tags already in use, most used first. Done copies of recurring tasks would count one task many times.
  private tagged = liveRows<Task>('tasks', () => (q) => q.neq('tags', '{}'));
  private known = computed(() => tagCounts(this.tagged.rows().filter((t) => !t.recurring_copy)).map(([t]) => t));
  readonly parsed = computed(() => parseQuick(this.text()));
  readonly suggestions = computed(() => suggestTags(this.text(), this.known()));
  readonly logging = computed(() => !!this.ui.quick().defaults().completed_at);
  readonly understood = computed(() => {
    const q = this.parsed();
    const out: { icon: IconName; label: string }[] = [];
    if (!this.logging() && q.date) out.push({ icon: 'calendar', label: dayTitle(q.date) });
    if (!this.logging() && q.time) out.push({ icon: 'clock', label: q.time });
    if (q.priority) out.push({ icon: 'flag', label: tr('Ưu tiên {n}', { n: q.priority }) });
    for (const t of q.tags) out.push({ icon: 'tag', label: `#${t}` });
    return out;
  });
  readonly hints = computed(() => {
    const q = this.parsed();
    const out: [string, string][] = [];
    if (!this.logging() && !q.date) out.push([X.tomorrow, tr('ngày mai')], [X.weekday, tr('thứ Sáu tới')], [X.day, tr('một ngày')]);
    if (!this.logging() && !q.time) out.push([X.time, tr('giờ bắt đầu')]);
    if (!q.priority) out.push([X.priority, tr('ưu tiên 1, !2, !3')]);
    out.push([X.tag, tr('nhãn')]);
    return out;
  });

  constructor() {
    // "N" anywhere outside a field, or a "Thêm việc" button, focuses the box.
    let first = true;
    effect(() => {
      this.ui.quickFocus();
      if (first) { first = false; return; }
      this.input().nativeElement.focus();
    });
  }

  change(v: string) {
    this.text.set(v);
    if (this.error()) this.error.set('');
  }
  private edit(v: string) {
    this.text.set(v);
    this.input().nativeElement.focus(); // the chip took focus from the box
  }
  pick(tag: string) {
    this.edit(completeTag(this.text(), tag));
  }
  // "#" is left open so the tag suggestions take over; everything else gets a space to type on.
  insert(token: string) {
    this.edit(`${this.text().trimEnd()} ${token}`.trimStart() + (token === X.tag ? '' : ' '));
  }
  keydown(e: KeyboardEvent) {
    if (e.key === 'Tab' && !e.shiftKey && this.suggestions().length) {
      e.preventDefault();
      this.pick(this.suggestions()[0]);
    } else if (e.key === 'Escape') {
      this.input().nativeElement.blur();
    }
  }
  onFocus() {
    clearTimeout(this.blur);
    this.focused.set(true);
  }
  // Late, so a click on a chip lands before the panel goes.
  onBlur() {
    this.blur = setTimeout(() => this.focused.set(false), 180);
  }

  async add() {
    const q = this.parsed();
    if (!q.title || this.busy()) return; // only syntax and tags: no title to save
    this.busy.set(true);
    const ok = await this.tasks.quickAdd(q, this.ui.quick().defaults());
    this.busy.set(false);
    if (!ok) {
      this.error.set(tr('Chưa lưu được. Kiểm tra mạng rồi thử lại.'));
      return;
    }
    this.text.set('');
    this.count.update((n) => n + 1);
    this.added.emit();
  }
}
