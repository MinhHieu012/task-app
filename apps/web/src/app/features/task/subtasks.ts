import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { titleHtml, titleText } from '@core/html';
import { tr } from '@core/i18n';
import { fmtSpan, spanError } from '@core/subtasks';
import type { Subtask, Task } from '@core/types';

import { TrPipe } from '../../core/prefs.service';
import { TasksService } from '../../core/tasks.service';
import { Icon } from '../../shared/icon';
import { RichEditor } from '../../shared/rich-editor';
import { Tick } from '../../shared/tick';

interface Draft { start_date: string; start_time: string; end_date: string; end_time: string }

/** A task's checklist. Saves on each change. Loaded once, not live: only this list edits it, and a realtime
 *  refetch would undo an optimistic tick. The typed-but-unadded title is added by the drawer's Lưu (flush). */
@Component({
  selector: 'app-subtasks',
  imports: [FormsModule, TrPipe, Icon, RichEditor, Tick],
  templateUrl: './subtasks.html',
  styles: `
    .list { display: flex; flex-direction: column; }
    .item { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: var(--rule-hair) solid var(--color-rule); }
    .item app-tick { margin-top: 2px; }
    .open { all: unset; flex: 1; min-width: 0; cursor: pointer; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 2px; }
    .open:hover .t { color: var(--color-accent); }
    .open:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .t { font-size: var(--text-sm); transition: color var(--dur-micro) var(--ease-out); overflow-wrap: anywhere; }
    .t.done { color: var(--color-muted); text-decoration: line-through; }
    .editor { display: flex; flex-direction: column; gap: 12px; padding: 14px; margin: 8px 0; border: var(--rule-hair) solid var(--color-rule); border-radius: var(--radius-ctl); background: var(--color-paper); }
    .pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    .add { margin-top: 12px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Subtasks {
  readonly task = input.required<Task>();
  private tasks = inject(TasksService);
  readonly rows = signal<Subtask[]>([]);
  readonly editing = signal<string | null>(null);
  readonly draft = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly when = signal<Draft>({ start_date: '', start_time: '', end_date: '', end_time: '' });
  private editTitle = { html: '', text: '' };
  readonly fmtSpan = fmtSpan;
  readonly titleHtml = titleHtml;

  constructor() {
    effect(() => {
      const id = this.task().id;
      this.tasks.subtasksOf(id).then((r) => r && this.rows.set(r));
    });
  }

  done() {
    return this.rows().filter((r) => r.done).length;
  }

  async add() {
    const t = this.draft().trim();
    if (!t || this.busy()) return true;
    this.busy.set(true);
    const row = await this.tasks.addSubtask(this.task().id, t);
    this.busy.set(false);
    if (!row) return false;
    this.rows.update((r) => [...r, row]);
    this.draft.set('');
    return true;
  }
  /** Called by the drawer's Lưu, so a typed subtask is not silently dropped. */
  flush() {
    return this.add();
  }

  async toggle(row: Subtask) {
    const set = (done: boolean) => this.rows.update((r) => r.map((x) => (x.id === row.id ? { ...x, done } : x)));
    set(!row.done);
    if (!(await this.tasks.updateSubtask(row.id, { done: !row.done }))) set(row.done);
  }

  async remove(row: Subtask) {
    if (await this.tasks.removeSubtask(row.id)) this.rows.update((r) => r.filter((x) => x.id !== row.id));
  }

  edit(row: Subtask) {
    this.editing.set(row.id);
    this.error.set('');
    this.editTitle = { html: titleHtml(row), text: row.title };
    this.when.set({
      start_date: row.start_date ?? '', start_time: row.start_time?.slice(0, 5) ?? '',
      end_date: row.end_date === row.start_date ? '' : (row.end_date ?? ''), end_time: row.end_time?.slice(0, 5) ?? '',
    });
  }
  setTitle(e: { html: string; text: string }) {
    this.editTitle = { html: e.html, text: titleText(e.text) };
  }
  setWhen(k: keyof Draft, v: string) {
    this.when.update((w) => ({ ...w, [k]: v }));
  }

  /** Must fit inside the parent's span. A blank start day with a time is the parent's start day; a blank end day the start day. */
  async save(row: Subtask) {
    const w = this.when();
    const task = this.task();
    const sd = w.start_date || (w.start_time ? task.due_date : null);
    const st = w.start_time || null;
    const ed = w.end_date || (w.end_time ? sd : null);
    const et = w.end_time || null;
    const e = !this.editTitle.text ? tr('Cần có tên việc')
      : st && !sd ? tr('Việc cha chưa có ngày, nên việc con chưa đặt ngày được')
      : spanError(task, { start_date: sd, start_time: st, end_date: ed, end_time: et });
    this.error.set(e);
    if (e) return;
    const patch = { title: this.editTitle.text, title_html: this.editTitle.html, start_date: sd, start_time: st, end_date: ed, end_time: et };
    this.busy.set(true);
    const ok = await this.tasks.updateSubtask(row.id, patch);
    this.busy.set(false);
    if (!ok) return;
    this.rows.update((all) => all.map((y) => (y.id === row.id ? { ...y, ...patch } : y)));
    this.editing.set(null);
  }
}
