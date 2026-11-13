import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { addDays, fromIso, nextMonday, today } from '@core/dates';
import { titleHtml, titleText } from '@core/html';
import { tr } from '@core/i18n';
import { spanError } from '@core/subtasks';
import { fmtTags, parseTags, tagCounts } from '@core/tags';
import { buildRepeat } from '@core/tasks';
import type { Project, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { TrPipe } from '../../core/prefs.service';
import { TasksService } from '../../core/tasks.service';
import { Icon } from '../../shared/icon';
import { RichEditor } from '../../shared/rich-editor';
import { Subtasks } from './subtasks';

type Kind = '' | 'daily' | 'weekly' | 'monthly' | 'every';
const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** The open task (?task=<id>): a drawer on the right, full screen on phones. A native modal <dialog>, so focus
 *  stays inside and Esc closes. Explicit Lưu, like the old form: nothing is saved while typing. */
@Component({
  selector: 'app-task-drawer',
  imports: [ReactiveFormsModule, TrPipe, Icon, RichEditor, Subtasks],
  templateUrl: './task-drawer.html',
  styleUrl: './task-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDrawer {
  readonly id = input.required<string>();
  readonly closed = output();
  private tasks = inject(TasksService);
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private subtasks = viewChild(Subtasks);

  private row = liveRows<Task>('tasks', () => {
    const id = this.id();
    return (q) => q.eq('id', id);
  });
  private projectRows = liveRows<Project>('projects', () => (q) => q.order('name'));
  private tagged = liveRows<Task>('tasks', () => (q) => q.neq('tags', '{}'));
  readonly projects = this.projectRows.rows;
  readonly loaded = this.row.loaded;
  /** Frozen once loaded: a realtime refetch while editing must not reset the form under the cursor. */
  readonly task = linkedSignal<Task | undefined, Task | undefined>({
    source: () => (this.row.loaded() ? this.row.rows()[0] : undefined),
    computation: (next, prev) => (prev?.value && prev.value.id === next?.id ? prev.value : next),
  });
  readonly projectName = computed(() => this.projects().find((p) => p.id === this.task()?.project_id)?.name ?? tr('Hộp thư'));

  readonly days = DAYS;
  readonly quickDays = [[today(), 'Hôm nay'], [addDays(today(), 1), 'Ngày mai'], [nextMonday(today()), 'Thứ Hai tới']] as const;
  readonly kinds: [Kind, string][] = [['', 'Không lặp'], ['daily', 'Hằng ngày'], ['weekly', 'Hằng tuần'], ['monthly', 'Hằng tháng'], ['every', 'Mỗi N ngày']];

  readonly form = new FormGroup({
    tags: new FormControl('', { nonNullable: true }),
    priority: new FormControl(4, { nonNullable: true }),
    project: new FormControl('', { nonNullable: true }),
    date: new FormControl('', { nonNullable: true }),
    time: new FormControl('', { nonNullable: true }),
    endDate: new FormControl('', { nonNullable: true }),
    endTime: new FormControl('', { nonNullable: true }),
    kind: new FormControl<Kind>('', { nonNullable: true }),
    everyN: new FormControl('', { nonNullable: true }),
  });
  readonly weekDays = signal<number[]>([]);
  readonly errors = signal<Record<string, string>>({});
  readonly busy = signal(false);
  private title = { html: '', text: '' };
  private note: string | null = null;
  private filled = '';

  readonly values = signal(this.form.getRawValue());
  readonly picked = computed(() => parseTags(this.values().tags));
  readonly known = computed(() => [...new Set([...tagCounts(this.tagged.rows().filter((t) => !t.recurring_copy)).map(([t]) => t), ...this.picked()])]);

  constructor() {
    this.form.valueChanges.subscribe(() => this.values.set(this.form.getRawValue()));
    afterNextRender(() => this.dialog().nativeElement.showModal());
    effect(() => {
      const t = this.task();
      if (!t || this.filled === t.id) return;
      this.filled = t.id;
      const [k, arg = ''] = (t.repeat ?? '').split(':');
      this.title = { html: titleHtml(t), text: t.title };
      this.note = t.note;
      this.form.reset({
        tags: fmtTags(t.tags), priority: t.priority, project: t.project_id ?? '',
        date: t.due_date ?? '', time: t.due_time?.slice(0, 5) ?? '',
        // An end on the start day shows blank: "blank = the start day".
        endDate: t.end_date === t.due_date ? '' : (t.end_date ?? ''), endTime: t.end_time?.slice(0, 5) ?? '',
        kind: k as Kind, everyN: k === 'every' ? arg : '',
      });
      this.weekDays.set(k === 'weekly' ? arg.split(',').map(Number) : []);
      this.errors.set({});
    });
  }

  titleHtml = titleHtml;
  setTitle(e: { html: string; text: string }) { this.title = { html: e.html, text: titleText(e.text) }; }
  setNote(e: { html: string; text: string }) { this.note = e.text.trim() ? e.html : null; }

  toggleTag(t: string) {
    const p = this.picked();
    this.form.controls.tags.setValue(fmtTags(p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  }
  toggleDay(d: number) {
    this.weekDays.update((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]));
  }
  clearDates() {
    this.form.patchValue({ date: '', time: '', endDate: '', endTime: '' });
  }

  close() {
    this.dialog().nativeElement.close();
  }

  async save() {
    const t = this.task();
    if (!t || this.busy()) return;
    const v = this.form.getRawValue();
    const e: Record<string, string> = {};
    const due = v.date || null;
    const at = v.time || null;
    if (!this.title.text) e['title'] = tr('Cần có tên việc');
    if (at && !due) e['time'] = tr('Đặt giờ thì cần có ngày');
    const endDue = v.endDate || due; // blank end day = the start day
    const end = v.endTime || null;
    if (v.endDate && !end) e['endTime'] = tr('Đặt ngày kết thúc thì cần có giờ kết thúc');
    else if (end && !at && !e['time']) e['endTime'] = tr('Đặt giờ kết thúc thì cần có giờ bắt đầu');
    else if (end && at && endDue && due && `${endDue} ${end}` <= `${due} ${at}`) e['endTime'] = tr('Thời gian kết thúc phải sau lúc bắt đầu');
    if (v.kind && !due) e['repeat'] = tr('Việc lặp lại cần có ngày bắt đầu');
    if (v.kind === 'weekly' && !this.weekDays().length) e['repeat'] = tr('Chọn ít nhất một thứ');
    if (v.kind === 'every' && !/^[1-9]\d*$/.test(v.everyN.trim())) e['repeat'] = tr('Gõ số ngày, từ 1 trở lên');
    this.errors.set(e);
    if (Object.keys(e).length) return this.focusError();

    const patch = {
      title: this.title.text, title_html: this.title.html, note: this.note, priority: v.priority, project_id: v.project || null, tags: parseTags(v.tags),
      due_date: due, due_time: at, end_date: end && endDue, end_time: end, repeat: buildRepeat(v.kind, this.weekDays(), v.everyN, due),
    };
    this.busy.set(true);
    // Subtasks must stay inside the parent's span, so a new span can't leave one outside.
    const subs = await this.tasks.subtasksOf(t.id);
    const outside = subs?.find((x) => spanError(patch, x));
    if (!subs || outside) {
      this.busy.set(false);
      if (outside) {
        this.errors.set({ date: tr('Việc con “{name}” sẽ nằm ngoài thời gian mới. Sửa việc con trước.', { name: outside.title }) });
        this.focusError();
      }
      return;
    }
    // A subtask typed but not yet added would be lost when the drawer closes.
    const ok = (await this.tasks.update(t.id, patch)) && (await (this.subtasks()?.flush() ?? true));
    this.busy.set(false);
    if (ok) this.close();
  }

  async remove() {
    const t = this.task();
    if (t && (await this.tasks.remove(t))) this.close();
  }

  /** A failed save moves focus to the first field it names. */
  private focusError() {
    setTimeout(() => this.dialog().nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  monthlyDay() {
    const d = this.values().date;
    return d ? String(fromIso(d).getDate()) : '…';
  }
}
