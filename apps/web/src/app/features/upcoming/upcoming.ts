import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { addDays, daysIn, fmtDay, fromIso, type Span, spanRange, today, toIso } from '@core/dates';
import { tr } from '@core/i18n';
import type { Project, Task } from '@core/types';

import { liveRows } from '../../core/live';
import { TrPipe } from '../../core/prefs.service';
import { openTaskId, UiService, useQuickAdd } from '../../core/ui.service';
import { Icon } from '../../shared/icon';
import { TaskGroup } from '../../shared/task-group';

type Pick = Span | 'custom';
const SPANS: [Pick, string][] = [['3d', '3 ngày'], ['1w', '1 tuần'], ['2w', '2 tuần'], ['1m', '1 tháng'], ['q', 'Quý'], ['y', 'Năm'], ['custom', 'Tự chọn']];
const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const LANES = 14; // up to two weeks shows every day as a lane; longer ranges show month grids
const MORE = 3; // task chips per month cell before "+N"

/** Open tasks due from tomorrow. The range is in the URL (?span, ?n, ?from, ?to), so it survives a reload and a
 *  back button. Short ranges: one lane per day, side by side (stacked on phones). Long ranges: month grids. */
@Component({
  selector: 'app-upcoming',
  imports: [TrPipe, Icon, TaskGroup],
  templateUrl: './upcoming.html',
  styleUrl: './upcoming.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Upcoming {
  readonly span = input<string>();
  readonly n = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  /** From Today's week strip: the lane to scroll to. */
  readonly day = input<string>();
  private router = inject(Router);
  readonly ui = inject(UiService);
  readonly openId = openTaskId();
  readonly today = today();
  readonly spans = SPANS;
  readonly pick = computed<Pick>(() => (SPANS.some(([k]) => k === this.span()) ? (this.span() as Pick) : '1w'));
  readonly step = computed(() => Math.max(0, Number(this.n() ?? 0) || 0));
  readonly customErr = computed(() => (this.from() && this.to() && this.from()! > this.to()! ? tr('Ngày bắt đầu phải trước ngày kết thúc') : ''));
  readonly range = computed<[string, string]>(() => {
    if (this.pick() !== 'custom') return spanRange(this.pick() as Span, this.today, this.step());
    const [f, t] = [this.from(), this.to()];
    return f && t && !this.customErr() ? [f > this.today ? f : addDays(this.today, 1), t] : [this.today, this.today]; // [today, today] matches nothing
  });
  readonly days = computed(() => {
    const [f, t] = this.range();
    return f <= t ? daysIn(f, t) : [];
  });
  readonly lanes = computed(() => this.days().length <= LANES);
  readonly period = computed(() => {
    const end = fromIso(this.range()[1]);
    return this.pick() === 'q' ? `Q${Math.floor(end.getMonth() / 3) + 1}/${end.getFullYear()}` : this.pick() === 'y' ? `${end.getFullYear()}` : '';
  });

  private rows = liveRows<Task>('tasks', () => {
    const [f, t] = this.range();
    return (q) => q.is('completed_at', null).gt('due_date', this.today).gte('due_date', f).lte('due_date', t).order('due_date').order('due_time', { nullsFirst: false }).order('priority');
  });
  private projectRows = liveRows<Project>('projects');
  readonly loaded = this.rows.loaded;
  readonly projects = this.projectRows.rows;
  readonly open = this.rows.rows;
  readonly shown = computed(() => (this.lanes() ? this.days() : this.days().filter((d) => this.open().some((t) => t.due_date === d))));
  readonly months = computed(() => {
    const [f, t] = this.range();
    const out: string[] = [];
    for (let d = `${f.slice(0, 7)}-01`; d <= t; d = toIso(new Date(+d.slice(0, 4), +d.slice(5, 7), 1))) out.push(d);
    return out;
  });

  private strip = viewChild<ElementRef<HTMLElement>>('strip');
  readonly edges = signal({ start: true, end: true });

  constructor() {
    useQuickAdd(() => {
      const d = this.day();
      return d ? { defaults: () => ({ due_date: d }), placeholder: ['Thêm việc cho {day}…', { day: this.label(d) }] } : { defaults: () => ({}), placeholder: ['Thêm vào Hộp thư…'] };
    });
    // A day picked on Today: bring its lane into view once the lanes are there.
    afterRenderEffect(() => {
      const d = this.day();
      if (!d || !this.loaded()) return;
      document.getElementById(`lane-${d}`)?.scrollIntoView({ block: 'nearest', inline: 'start' });
    });
    afterRenderEffect(() => {
      this.shown();
      this.measure();
    });
  }

  label(d: string) {
    return `${d === addDays(this.today, 1) ? tr('Ngày mai') : tr(DAYS[fromIso(d).getDay()])}, ${fmtDay(d)}`;
  }
  tasksOn(d: string) {
    return this.open().filter((t) => t.due_date === d);
  }
  fmtDay = fmtDay;

  set(params: Record<string, string | number | null>) {
    this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }
  choose(p: Pick) {
    this.set({ span: p, n: null, day: null });
  }

  measure() {
    const el = this.strip()?.nativeElement;
    if (el) this.edges.set({ start: el.scrollLeft <= 0, end: el.scrollLeft >= el.scrollWidth - el.clientWidth - 1 });
  }
  slide(dir: number) {
    const el = this.strip()?.nativeElement;
    el?.scrollBy({ left: dir * 296, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /** One month as a Monday-first grid; days outside the range are dimmed. */
  weeks(first: string) {
    const start = fromIso(first);
    const lead = (start.getDay() + 6) % 7;
    const count = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  }
  monthTitle(first: string) {
    return tr('Tháng {m}, {y}', { m: Number(first.slice(5, 7)), y: first.slice(0, 4) });
  }
  outside(d: string | null) {
    const [f, t] = this.range();
    return !d || d < f || d > t;
  }
  readonly more = MORE;
  readonly wd = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
}
