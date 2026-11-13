import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { addDays, fmtDate, fromIso, today, toIso } from '@core/dates';
import { tr } from '@core/i18n';
import { DEADLINE, matches, reportStats, reportStatus, snippet, type Status } from '@core/reports';
import type { Report } from '@core/types';

import { liveRows } from '../../core/live';
import { TrPipe } from '../../core/prefs.service';
import { Calendar, dayForMonth, monthOf } from '../../shared/calendar';
import { Icon } from '../../shared/icon';
import { ReportBadge } from '../../shared/report-bits';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Every daily report, newest first, searchable; the aside shows a month of report marks and the running totals. */
@Component({
  selector: 'app-reports',
  imports: [RouterLink, TrPipe, Icon, Calendar, ReportBadge],
  template: `
    <div class="page with-aside">
      <header class="page-head">
        <div>
          <h1>{{ 'Báo cáo ngày' | tr }}</h1>
          @if (list.loaded()) { <p class="meta">{{ '{n} báo cáo, {late} nộp trễ' | tr: { n: all().length, late: lateN() } }}</p> }
        </div>
        @if (list.loaded()) {
          <a [class]="mine() ? 'btn' : 'btn btn-primary'" [routerLink]="['/report', now]"><app-icon [name]="mine() ? 'edit' : 'plus'" [size]="16" />{{ (mine() ? 'Sửa báo cáo hôm nay' : 'Viết báo cáo hôm nay') | tr }}</a>
        }
      </header>
      <div class="page-main">
        <form role="search" (submit)="$event.preventDefault()">
          <div class="input-wrap"><app-icon name="search" />
            <input class="input" type="search" name="q" autocomplete="off" [attr.aria-label]="'Tìm trong báo cáo' | tr" [placeholder]="'Tìm trong báo cáo…' | tr" [value]="q()" (input)="q.set(box.value)" #box />
          </div>
        </form>
        @if (!list.loaded()) {
          <div class="sheet">@for (i of [0, 1, 2]; track i) { <div class="skel"><span class="skeleton" style="width: 40%; height: 16px"></span><span class="skeleton" style="width: 80%; height: 12px"></span></div> }</div>
        } @else if (!all().length) {
          <div class="sheet empty">
            <app-icon name="file" [size]="28" />
            <h2>{{ 'Chưa có báo cáo nào' | tr }}</h2>
            <p>{{ 'Cuối mỗi ngày, trước {time}, viết vài dòng về việc đã làm. Bản nháp được tạo sẵn từ nhật ký.' | tr: { time: deadline } }}</p>
            <div class="actions"><a class="btn btn-primary" [routerLink]="['/report', now]">{{ 'Viết báo cáo hôm nay' | tr }}</a></div>
          </div>
        } @else if (!shown().length) {
          <p class="sheet empty-line">{{ 'Không có báo cáo nào khớp “{q}”.' | tr: { q: q().trim() } }}</p>
        } @else {
          <ul class="sheet list">
            @for (r of shown(); track r.id) {
              <li>
                <a class="item" [routerLink]="['/report', r.day]">
                  <span class="head"><b class="num">{{ weekday(r.day) }}, {{ fmtDate(r.day) }}</b><app-report-badge [status]="r.late ? 'late' : 'ontime'" /><span class="meta grow right">{{ '{done} việc xong, {missed} lỡ' | tr: { done: r.done_count, missed: r.missed_count } }}</span></span>
                  <span class="meta clamp-2">{{ snippet(r.body, q()) }}</span>
                </a>
              </li>
            }
          </ul>
        }
      </div>
      @if (all().length) {
        <aside class="page-aside">
          <section class="sheet sheet-pad" [attr.aria-label]="'Lịch báo cáo' | tr">
            <app-calendar [y]="ym().year" [m]="ym().month" [selected]="day()" [counts]="counts()" [missed]="missed()" [reports]="statuses()" (pick)="open($event)" (month)="day.set(dayFor(ym().year, ym().month + $event))" />
          </section>
          <section aria-labelledby="ro">
            <div class="sheet-head"><h2 id="ro" class="section-title">{{ 'Tổng quan' | tr }}</h2></div>
            <div class="info-line"><app-icon name="circle-check" />{{ 'Đúng hạn' | tr }}<span class="n" [class.success-text]="st().ontime">{{ st().ontime }}</span></div>
            <div class="info-line"><app-icon name="clock" />{{ 'Nộp trễ' | tr }}<span class="n" [class.warning-text]="st().late">{{ st().late }}</span></div>
            <div class="info-line"><app-icon name="alert" />{{ 'Thiếu báo cáo' | tr }}<span class="n" [class.danger-text]="st().missing">{{ st().missing }}</span></div>
            <div class="info-line"><app-icon name="flame" />{{ 'Chuỗi hiện tại' | tr }}<span class="n">{{ '{n} ngày' | tr: { n: st().streak } }}</span></div>
            <div class="info-line"><app-icon name="flame" />{{ 'Chuỗi đúng hạn' | tr }}<span class="n">{{ '{n} ngày' | tr: { n: st().ontimeStreak } }}</span></div>
          </section>
        </aside>
      }
    </div>
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; overflow: hidden; }
    .list li { border-bottom: var(--rule-hair) solid var(--color-rule); }
    .list li:last-child { border-bottom: 0; }
    .item { display: flex; flex-direction: column; gap: 6px; padding: 16px 20px; text-decoration: none; color: var(--color-ink); transition: background-color var(--dur-micro) var(--ease-out); }
    .item:hover { background: var(--color-hover); }
    .item:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
    .head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
    .right { text-align: right; }
    .skel { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border-bottom: var(--rule-hair) solid var(--color-rule); }
    .empty > app-icon { color: var(--color-accent); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reports {
  private router = inject(Router);
  readonly now = today();
  readonly deadline = DEADLINE;
  // ponytail: loads every report and searches on the device; page it if this grows into years.
  readonly list = liveRows<Report>('daily_reports', () => (q) => q.order('day', { ascending: false }));
  readonly all = this.list.rows;
  readonly q = signal('');
  readonly shown = computed(() => (this.q().trim() ? this.all().filter((r) => matches(r.body, this.q())) : this.all()));
  readonly lateN = computed(() => this.all().filter((r) => r.late).length);
  readonly mine = computed(() => this.all().find((r) => r.day === this.now));
  readonly day = signal(this.now);
  readonly ym = computed(() => monthOf(this.day()));
  private by = computed(() => new Map(this.all().map((r) => [r.day, r])));
  private since = computed(() => this.all().at(-1)?.day ?? null); // sorted newest first
  readonly counts = computed(() => {
    const out: Record<string, number> = {};
    for (let d = 1, n = new Date(this.ym().year, this.ym().month, 0).getDate(); d <= n; d++) {
      const iso = toIso(new Date(this.ym().year, this.ym().month - 1, d));
      out[iso] = this.by().get(iso)?.done_count ?? 0;
    }
    return out;
  });
  readonly missed = computed(() => new Set(Object.keys(this.counts()).filter((d) => this.by().get(d)?.missed_count)));
  readonly statuses = computed<Record<string, Status>>(() => Object.fromEntries(Object.keys(this.counts()).map((d) => [d, reportStatus(d, this.by().get(d), this.since())])));
  readonly st = computed(() => {
    // ponytail: walks every day since the first report; fine for years of reports.
    const days: string[] = [];
    for (let d = this.since(); d && d <= this.now; d = addDays(d, 1)) days.push(d);
    return reportStats(days, this.all(), this.since());
  });
  fmtDate = fmtDate;
  snippet = snippet;
  dayFor = dayForMonth;
  weekday = (d: string) => tr(WEEKDAY[fromIso(d).getDay()]);
  open(d: string) {
    this.router.navigate(['/report', d]);
  }
}
