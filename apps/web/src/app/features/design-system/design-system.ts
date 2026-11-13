import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PrefsService } from '../../core/prefs.service';
import { Icon } from '../../shared/icon';
import { Tick } from '../../shared/tick';

const COLORS = ['paper', 'paper-2', 'sheet', 'ink', 'ink-2', 'muted', 'rule', 'rule-strong', 'edge', 'accent', 'accent-wash', 'success', 'warning', 'danger', 'p1', 'p2', 'p3', 'p4'];
const TYPE: [string, string][] = [['--text-3xl', 'Display 33'], ['--text-2xl', 'Page title 28'], ['--text-xl', 'Heading 23'], ['--text-lg', 'Section 19'], ['--text-md', 'Body 16'], ['--text-sm', 'Meta 14'], ['--text-xs', 'Caption 12']];

/** A living reference of the web design system: the tokens and every control in its states. Public, no data.
 *  Developer-facing, so its own copy is English and stays out of the translation table. */
@Component({
  selector: 'app-design-system',
  imports: [RouterLink, Icon, Tick],
  template: `
    <div class="page narrow">
      <header class="page-head">
        <div><h1>Design system</h1><p class="meta">Tokens in <code>src/styles/tokens.css</code>, recomputed from the accent and theme by <code>core/theme/palette.ts</code>.</p></div>
        <div class="row">
          <div class="seg" role="radiogroup" aria-label="Theme">
            <button type="button" role="radio" [attr.aria-checked]="!prefs.dark()" (click)="prefs.setTheme('light')">Light</button>
            <button type="button" role="radio" [attr.aria-checked]="prefs.dark()" (click)="prefs.setTheme('dark')">Dark</button>
          </div>
          <a class="btn" routerLink="/">App</a>
        </div>
      </header>

      <section class="sheet sheet-pad stack"><h2>Colour</h2>
        <div class="swatches">@for (c of colors; track c) { <div class="sw"><span [style.background]="'var(--color-' + c + ')'"></span><code>{{ c }}</code></div> }</div>
      </section>

      <section class="sheet sheet-pad stack"><h2>Type, Be Vietnam Pro</h2>
        @for (t of type; track t[0]) { <p [style.font-size]="'var(' + t[0] + ')'" class="type-line"><span class="meta">{{ t[1] }}</span> Việc hôm nay, nhật ký đã xong</p> }
        <p class="num">Tabular figures: 09:00 – 10:30 · 1 234 567</p>
      </section>

      <section class="sheet sheet-pad stack"><h2>Buttons</h2>
        <div class="row">
          <button type="button" class="btn btn-primary"><app-icon name="plus" [size]="16" />Primary</button>
          <button type="button" class="btn">Secondary</button>
          <button type="button" class="btn btn-ghost">Ghost</button>
          <button type="button" class="btn btn-danger"><app-icon name="trash" [size]="16" />Danger</button>
          <button type="button" class="btn btn-sm">Small</button>
          <button type="button" class="btn" disabled>Disabled</button>
          <button type="button" class="btn btn-primary" aria-busy="true"><span class="spinner"></span>Loading</button>
          <button type="button" class="btn btn-icon" aria-label="Icon button"><app-icon name="settings" /></button>
          <button type="button" class="link">Text link</button>
        </div>
      </section>

      <section class="sheet sheet-pad stack"><h2>Fields</h2>
        <div class="grid2">
          <div class="field"><label for="ds-a">Label</label><input id="ds-a" class="input" placeholder="Placeholder" /><p class="hint">Helper text</p></div>
          <div class="field"><label for="ds-b">Invalid</label><input id="ds-b" class="input" aria-invalid="true" value="sai" /><p class="error-text">What went wrong and how to fix it</p></div>
          <div class="field"><label for="ds-c">Date</label><input id="ds-c" class="input" type="date" /></div>
          <div class="field"><label for="ds-d">Disabled</label><input id="ds-d" class="input" disabled value="Read only" /></div>
        </div>
      </section>

      <section class="sheet sheet-pad stack"><h2>Choices and status</h2>
        <div class="seg" role="radiogroup" aria-label="Segmented"><button type="button" role="radio" aria-checked="true">Week</button><button type="button" role="radio" aria-checked="false">Month</button></div>
        <div class="chips"><button type="button" class="chip" aria-pressed="true">#on</button><button type="button" class="chip" aria-pressed="false">#off</button><span class="tag">#tag</span></div>
        <div class="row"><span class="badge">Neutral</span><span class="badge success">Đã nộp</span><span class="badge warning">Nộp trễ</span><span class="badge error">Chưa nộp</span><span class="badge accent">Accent</span></div>
        <div class="row">@for (p of [1, 2, 3, 4]; track p) { <app-tick [priority]="p" label="Priority {{ p }}" /> }<app-tick [checked]="true" label="Done" /></div>
      </section>

      <section class="stack"><h2>The ledger</h2>
        <div class="sheet-head"><h3 class="section-title">Hôm nay <span class="meta num">2</span></h3></div>
        <div class="sheet ledger">
          <div class="l"><span class="when num"><b>09:00</b><span class="meta">Bắt đầu</span></span><span class="grow">Gửi báo cáo tuần</span><span class="badge accent">#công-việc</span></div>
          <div class="l"><span class="when num"><b>Cả ngày</b><span class="meta">Chưa hẹn giờ</span></span><span class="grow">Review thiết kế</span></div>
        </div>
      </section>

      <section class="sheet empty"><h2>Empty state</h2><p>What belongs here, and the one action that fills it.</p><div class="actions"><button type="button" class="btn btn-primary">Thêm việc</button></div></section>
      <section class="sheet sheet-pad stack" aria-label="Loading"><h2>Loading</h2><span class="skeleton" style="height: 14px; width: 60%"></span><span class="skeleton" style="height: 12px; width: 30%"></span></section>
    </div>
  `,
  styles: `
    .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
    .sw { display: flex; flex-direction: column; gap: 6px; font-size: var(--text-xs); }
    .sw span { height: 48px; border-radius: var(--radius-ctl); border: var(--rule-hair) solid var(--color-rule); }
    .type-line { display: flex; align-items: baseline; gap: 16px; .meta { width: 120px; flex: none; font-size: var(--text-xs); } }
    .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .ledger .l { display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-bottom: var(--rule-hair) solid var(--color-rule); }
    .ledger .l:last-child { border-bottom: 0; }
    .when { display: flex; flex-direction: column; width: 120px; font-size: var(--text-sm); }
    code { font-size: var(--text-xs); }
    @media (max-width: 40rem) { .grid2 { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystem {
  readonly prefs = inject(PrefsService);
  readonly colors = COLORS;
  readonly type = TYPE;
}
