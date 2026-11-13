import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { fmtDay, today } from '@core/dates';

import { TrPipe } from '../core/prefs.service';

/** Done per day as bars; with `selectable` a bar selects its day. A week labels every bar, a month every fifth
 *  day. A warning mark under a bar: a task due that day was missed. Bars scale with transform, never height. */
@Component({
  selector: 'app-day-chart',
  imports: [TrPipe],
  template: `
    <section class="sheet sheet-pad" aria-labelledby="dc-title">
      <div class="row head">
        <h2 id="dc-title" class="section-title grow">{{ 'Việc xong theo ngày' | tr }}</h2>
        <span class="meta">{{ top() ? ('Cao nhất {n} việc' | tr: { n: top() }) : ('Chưa có việc nào xong' | tr) }}</span>
      </div>
      <div class="chart" [style.--n]="days().length">
        @for (d of days(); track d) {
          <button type="button" class="col" [disabled]="d > now || !selectable()" [class.on]="d === selected()" [attr.aria-pressed]="selectable() ? d === selected() : null"
            [attr.aria-label]="'{date}: {n} việc xong' | tr: { date: fmtDay(d), n: counts()[d] }" (click)="pick.emit(d)">
            <span class="area"><span class="bar" [class.zero]="!counts()[d]" [class.future]="d > now" [style.transform]="'scaleY(' + scale(d) + ')'"></span></span>
            <span class="miss" [class.has]="missed().has(d)"></span>
            <span class="tick num">{{ showTick(d) ? +d.slice(8) : '' }}</span>
          </button>
        }
      </div>
    </section>
  `,
  styles: `
    .head { margin-bottom: 16px; }
    .chart { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 4px; align-items: end; }
    .col { all: unset; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; border-radius: var(--radius-sm); }
    .col:disabled { cursor: default; }
    .col:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .area { width: 100%; height: 120px; display: flex; align-items: flex-end; justify-content: center; }
    .bar { width: min(100%, 28px); height: 100%; border-radius: 4px 4px 2px 2px; background: var(--color-bar); transform-origin: bottom; transition: background-color var(--dur-micro) var(--ease-out); }
    .bar.zero { background: var(--color-rule); }
    .bar.future { opacity: 0.4; }
    .col:not(:disabled):hover .bar { background: var(--color-bar-hover); }
    .col.on .bar { background: var(--color-accent); }
    .miss { width: 6px; height: 6px; border-radius: 50%; }
    .miss.has { background: var(--color-warning); }
    .tick { font-size: var(--text-xs); color: var(--color-muted); height: 16px; }
    .col.on .tick { color: var(--color-accent); font-weight: 600; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayChart {
  readonly counts = input.required<Record<string, number>>();
  readonly missed = input(new Set<string>());
  readonly selected = input('');
  readonly selectable = input(false);
  readonly pick = output<string>();
  readonly now = today();
  readonly fmtDay = fmtDay;
  readonly days = computed(() => Object.keys(this.counts()).sort());
  readonly top = computed(() => Math.max(0, ...this.days().map((d) => this.counts()[d])));
  scale(d: string) {
    const v = this.counts()[d];
    return v ? 0.05 + (v / Math.max(this.top(), 1)) * 0.95 : 0.03;
  }
  showTick(d: string) {
    return this.days().length <= 7 || Number(d.slice(8)) % 5 === 1 || d === this.selected();
  }
}
