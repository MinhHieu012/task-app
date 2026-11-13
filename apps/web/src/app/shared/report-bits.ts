import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { fmtDate, localDay } from '@core/dates';
import { DEADLINE, type Status } from '@core/reports';
import type { Report } from '@core/types';

import { TrPipe } from '../core/prefs.service';
import { Icon } from './icon';
import { sanitize } from './sanitize';

/** "HH:MM" local time of a timestamp. */
export const timeOf = (at: string) => new Date(at).toTimeString().slice(0, 5);
export const dateOf = (at: string) => fmtDate(localDay(new Date(at)));

const BADGE: Partial<Record<Status, [string, string]>> = {
  ontime: ['Đã nộp', 'success'],
  late: ['Nộp trễ', 'warning'],
  missing: ['Chưa nộp', 'error'],
  pending: ['Hạn {time}', ''],
};

@Component({
  selector: 'app-report-badge',
  imports: [TrPipe],
  template: `@if (b(); as b) { <span class="badge" [class]="b[1]">{{ b[0] | tr: { time: deadline } }}</span> }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportBadge {
  readonly status = input.required<Status>();
  readonly deadline = DEADLINE;
  readonly b = computed(() => BADGE[this.status()]);
}

/** Today: a reminder line until today's report is in (the web has no notifications), with the on-time streak.
 *  Past the deadline the streak is already lost, so it is not shown. */
@Component({
  selector: 'app-report-nudge',
  imports: [TrPipe, Icon, RouterLink],
  template: `
    <div class="nudge" [class.done]="report()" [class.late]="!report() && status() === 'missing'">
      <app-icon name="file" />
      <p class="grow">
        @if (report()) { {{ 'Đã nộp báo cáo hôm nay lúc {time}.' | tr: { time: timeOf(report()!.submitted_at) } }} }
        @else if (status() === 'missing') { {{ 'Đã quá {time}: báo cáo hôm nay vẫn nộp được nhưng sẽ tính là trễ.' | tr: { time: deadline } }} }
        @else { {{ 'Báo cáo ngày: hạn {time} tối nay.' | tr: { time: deadline } }} }
        @if (streak() && status() !== 'missing') { <span class="streak">{{ '{n} ngày đúng hạn' | tr: { n: streak() } }}</span> }
      </p>
      @if (report()) { <a class="link" [routerLink]="['/report', day()]">{{ 'Xem báo cáo' | tr }}</a> }
      @else { <a class="btn btn-sm" [routerLink]="['/report', day()]">{{ 'Viết báo cáo' | tr }}</a> }
    </div>
  `,
  styles: `
    .nudge { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: var(--radius-card); background: var(--color-accent-wash); font-size: var(--text-sm); }
    .nudge > app-icon { color: var(--color-accent); }
    .nudge.done { background: var(--color-success-wash); > app-icon { color: var(--color-success); } }
    .nudge.late { background: var(--color-danger-wash); > app-icon { color: var(--color-danger); } }
    .streak { margin-left: 8px; font-weight: 600; color: var(--color-accent); white-space: nowrap; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportNudge {
  readonly day = input.required<string>();
  readonly report = input<Report>();
  readonly status = input.required<Status>();
  readonly streak = input(0);
  readonly deadline = DEADLINE;
  readonly timeOf = timeOf;
}

/** The selected day's report in the Journal: read it, or a button to write it. */
@Component({
  selector: 'app-report-card',
  imports: [TrPipe, Icon, RouterLink, ReportBadge],
  template: `
    <section class="sheet sheet-pad stack" aria-labelledby="rc-title">
      <div class="row">
        <h3 id="rc-title" class="grow">{{ 'Báo cáo ngày' | tr }} <app-report-badge [status]="status()" /></h3>
        <a class="link" routerLink="/reports">{{ 'Tất cả báo cáo' | tr }}</a>
      </div>
      @if (report(); as r) {
        <div class="prose" [innerHTML]="html()"></div>
        <div class="row">
          <p class="meta grow">{{ 'Nộp lúc {time} ngày {date}' | tr: { time: timeOf(r.submitted_at), date: dateOf(r.submitted_at) } }}</p>
          <a class="btn btn-sm" [routerLink]="['/report', day()]"><app-icon name="edit" [size]="16" />{{ 'Sửa báo cáo' | tr }}</a>
        </div>
      } @else {
        <div class="row">
          <p class="meta grow">{{ status() === 'pending' ? ('Hạn nộp {time} tối nay.' | tr: { time: deadline }) : ('Chưa có báo cáo cho ngày này.' | tr) }}</p>
          <a class="btn btn-primary btn-sm" [routerLink]="['/report', day()]"><app-icon name="edit" [size]="16" />{{ 'Viết báo cáo' | tr }}</a>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportCard {
  readonly day = input.required<string>();
  readonly report = input<Report>();
  readonly status = input.required<Status>();
  readonly deadline = DEADLINE;
  readonly timeOf = timeOf;
  readonly dateOf = dateOf;
  /** The stored copy is never trusted as is: cleaned by the allow-list again on the way in. */
  readonly html = computed(() => sanitize(this.report()?.content ?? ''));
}
