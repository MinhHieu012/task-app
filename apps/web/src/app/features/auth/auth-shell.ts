import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TrPipe } from '../../core/prefs.service';

const FEATURES: [string, string][] = [
  ['Hôm nay rõ ràng', 'Việc quá hạn, việc hôm nay và việc kế tiếp trên một màn.'],
  ['Gom theo project', 'Thêm nhanh vào Hộp thư, xếp vào project khi rảnh.'],
  ['Nhật ký tự ghi', 'Việc xong nằm lại theo ngày, xem lại cả tháng.'],
];

/** The signed-out frame: on wide screens what the app does on the left, the form on the right; phones the form alone. */
@Component({
  selector: 'app-auth-shell',
  imports: [TrPipe],
  template: `
    <div class="split">
      <section class="intro" aria-labelledby="intro-title">
        <div class="brand"><span class="mark" aria-hidden="true"><svg viewBox="0 0 512 512"><g transform="translate(-20 -10) scale(1.08)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M236 330L266 360L444 150" stroke="currentColor" stroke-width="46"/><path d="M70 270L160 360L338 150" stroke="var(--color-accent)" stroke-width="98"/><path d="M70 270L160 360L338 150" stroke="currentColor" stroke-width="46"/></g></svg></span>{{ 'Việc & Nhật ký' | tr }}</div>
        <div class="pitch">
          <h1 id="intro-title" class="headline">{{ 'Biết hôm nay làm gì, nhớ hôm qua đã làm gì.' | tr }}</h1>
          <p class="lead">{{ 'Một nơi cho việc cần làm và nhật ký việc đã xong, đồng bộ giữa web và điện thoại.' | tr }}</p>
          <dl class="features">
            @for (f of features; track f[0]) { <div><dt>{{ f[0] | tr }}</dt><dd>{{ f[1] | tr }}</dd></div> }
          </dl>
        </div>
        <p class="meta">© {{ year }} {{ 'Việc & Nhật ký' | tr }}</p>
      </section>
      <main class="side">
        <div class="form">
          <div class="brand only-narrow"><span class="mark" aria-hidden="true"><svg viewBox="0 0 512 512"><g transform="translate(-20 -10) scale(1.08)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M236 330L266 360L444 150" stroke="currentColor" stroke-width="46"/><path d="M70 270L160 360L338 150" stroke="var(--color-accent)" stroke-width="98"/><path d="M70 270L160 360L338 150" stroke="currentColor" stroke-width="46"/></g></svg></span>{{ 'Việc & Nhật ký' | tr }}</div>
          <div class="heading">
            <h2>{{ title() }}</h2>
            @if (sub()) { <p class="muted">{{ sub() }}</p> }
          </div>
          <ng-content />
        </div>
      </main>
    </div>
  `,
  styles: `
    .split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 100dvh; background: var(--color-sheet); }
    .intro { display: flex; flex-direction: column; justify-content: space-between; gap: 40px; padding: 40px 56px; background: var(--color-accent-wash); }
    .pitch { display: flex; flex-direction: column; gap: 20px; max-width: 520px; }
    .headline { font-size: var(--text-3xl); line-height: 1.15; max-width: 22ch; overflow-wrap: break-word; min-width: 0; }
    .lead { color: var(--color-ink-2); }
    .features { margin: 12px 0 0; display: flex; flex-direction: column; gap: 14px; }
    .features div { padding-top: 14px; border-top: var(--rule-hair) solid var(--color-rule-strong); }
    dt { font-weight: 600; } dd { margin: 2px 0 0; color: var(--color-ink-2); font-size: var(--text-sm); }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 600; }
    .mark { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px; background: var(--color-accent); color: var(--color-accent-ink); }
    .mark svg { width: 22px; height: 22px; }
    .side { display: grid; place-items: center; padding: 40px 24px; }
    .form { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 24px; }
    .heading { display: flex; flex-direction: column; gap: 6px; }
    .heading h2 { font-size: var(--text-2xl); }
    .only-narrow { display: none; }
    @media (max-width: 60rem) {
      .split { grid-template-columns: minmax(0, 1fr); background: var(--color-paper); }
      .intro { display: none; }
      .side { place-items: start center; padding: 40px 16px; }
      .only-narrow { display: flex; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthShell {
  readonly title = input.required<string>();
  readonly sub = input('');
  readonly features = FEATURES;
  readonly year = new Date().getFullYear();
}
