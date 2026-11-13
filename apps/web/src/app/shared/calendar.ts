import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { fmtDay, today, toIso } from '@core/dates';
import { tr } from '@core/i18n';
import type { Status } from '@core/reports';

import { TrPipe } from '../core/prefs.service';
import { Icon } from './icon';

export const monthOf = (iso: string) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) });
/** Day to select after moving to another month: today in the current month, otherwise its last day. */
export function dayForMonth(year: number, month: number) {
  const now = today();
  const d = new Date(year, month - 1, 1);
  const [y, m] = [d.getFullYear(), d.getMonth() + 1];
  return now.startsWith(`${y}-${String(m).padStart(2, '0')}`) ? now : toIso(new Date(y, m, 0));
}

const MARK: Partial<Record<Status, [string, string]>> = {
  ontime: ['var(--color-success)', 'Báo cáo đúng hạn'],
  late: ['var(--color-warning)', 'Báo cáo trễ'],
  missing: ['var(--color-danger)', 'Thiếu báo cáo'],
};
const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** A month grid (weeks start Monday): done count per day, a warning mark on days with missed tasks, and the
 *  report status as a short bar at the foot of the day. Future days are not selectable. */
@Component({
  selector: 'app-calendar',
  imports: [TrPipe, Icon],
  template: `
    <div class="head">
      <button type="button" class="btn btn-icon btn-sm" (click)="month.emit(-1)" [attr.aria-label]="'Tháng trước' | tr"><app-icon name="chevron-left" /></button>
      <h3 class="grow num">{{ 'Tháng {m}, {y}' | tr: { m: m(), y: y() } }}</h3>
      <button type="button" class="btn btn-icon btn-sm" (click)="month.emit(1)" [disabled]="current()" [attr.aria-label]="'Tháng sau' | tr"><app-icon name="chevron-right" /></button>
    </div>
    <div class="grid" role="grid" [attr.aria-label]="'Tháng {m}, {y}' | tr: { m: m(), y: y() }">
      @for (d of wd; track d) { <span class="wd" role="columnheader">{{ d | tr }}</span> }
      @for (d of cells(); track $index) {
        @if (d) {
          <button type="button" class="day" role="gridcell" [class.on]="d === selected()" [class.today]="d === now" [disabled]="d > now"
            [attr.aria-selected]="d === selected()" [attr.aria-label]="label(d)" (click)="pick.emit(d)">
            <span class="n num">{{ +d.slice(8) }}</span>
            <span class="cnt num">{{ d <= now && counts()[d] ? counts()[d] : '' }}</span>
            @if (missed().has(d)) { <span class="miss"></span> }
            <span class="bar" [class.has]="mark(d)" [style.background]="mark(d)?.[0] ?? null"></span>
          </button>
        } @else { <span></span> }
      }
    </div>
    @if (hasMarks()) {
      <ul class="legend">
        @for (m of marks; track m[1]) { <li><span class="sw" [style.background]="m[0]"></span>{{ m[1] | tr }}</li> }
      </ul>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .head { display: flex; align-items: center; gap: 8px; h3 { text-align: center; } }
    .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
    .wd { text-align: center; font-size: var(--text-xs); color: var(--color-muted); padding: 4px 0; }
    .day { position: relative; aspect-ratio: 1 / 1.1; min-height: 46px; border: 0; border-radius: var(--radius-ctl); background: none; color: var(--color-ink); cursor: pointer;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; padding: 0;
      transition: background-color var(--dur-micro) var(--ease-out); }
    .day:hover { background: var(--color-hover); }
    .day:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; transition: none; }
    .day:disabled { cursor: default; .n { color: var(--color-muted); opacity: 0.6; } }
    .day:disabled:hover { background: none; }
    .day.today:not(.on) { box-shadow: inset 0 0 0 1px var(--color-accent); .n { color: var(--color-accent); font-weight: 700; } }
    .day.on { background: var(--color-accent); color: var(--color-accent-ink); .cnt { color: var(--color-accent-ink); } .bar.has { background: var(--color-accent-ink) !important; } }
    .n { font-size: var(--text-sm); font-weight: 500; }
    .cnt { font-size: 11px; height: 14px; color: var(--color-accent); font-weight: 600; }
    .miss { position: absolute; top: 6px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--color-warning); }
    .bar { width: 40%; height: 3px; margin-top: 3px; border-radius: 2px; } // always there (empty when no report) so digits line up across a week
    .legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: var(--text-xs); color: var(--color-muted); }
    .legend li { display: flex; align-items: center; gap: 6px; }
    .sw { width: 12px; height: 3px; border-radius: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Calendar {
  readonly y = input.required<number>();
  readonly m = input.required<number>(); // 1-based
  readonly selected = input('');
  readonly counts = input<Record<string, number>>({});
  readonly missed = input(new Set<string>());
  readonly reports = input<Record<string, Status>>({});
  readonly pick = output<string>();
  readonly month = output<number>();
  readonly now = today();
  readonly wd = WD;
  readonly marks = Object.values(MARK);
  readonly current = computed(() => this.now.startsWith(`${this.y()}-${String(this.m()).padStart(2, '0')}`));
  readonly cells = computed(() => {
    const lead = (new Date(this.y(), this.m() - 1, 1).getDay() + 6) % 7;
    const n = new Date(this.y(), this.m(), 0).getDate();
    return [...Array<null>(lead).fill(null), ...Array.from({ length: n }, (_, i) => toIso(new Date(this.y(), this.m() - 1, i + 1)))];
  });
  readonly hasMarks = computed(() => Object.values(this.reports()).some((r) => MARK[r]));
  mark(d: string) {
    return MARK[this.reports()[d]];
  }
  label(d: string) {
    const mk = this.mark(d);
    return tr('{date}: {n} việc xong', { date: fmtDay(d), n: this.counts()[d] ?? 0 }) + (this.missed().has(d) ? `, ${tr('có việc lỡ hạn')}` : '') + (mk ? `, ${tr(mk[1])}` : '');
  }
}
