import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { dayTitle, today } from '@core/dates';
import { endDay } from '@core/tasks';
import type { Task } from '@core/types';
import { filter, map } from 'rxjs';

import { Icon, type IconName } from '../../shared/icon';
import { QuickAdd } from '../../shared/quick-add';
import { TaskDrawer } from '../../features/task/task-drawer';
import { AuthService } from '../auth.service';
import { liveRows } from '../live';
import { TrPipe } from '../prefs.service';
import { openTaskId, UiService } from '../ui.service';

interface NavItem { path: string; label: string; icon: IconName; exact?: boolean }

const NAV: NavItem[] = [
  { path: '/', label: 'Hôm nay', icon: 'sun', exact: true },
  { path: '/upcoming', label: 'Sắp tới', icon: 'calendar-days' },
  { path: '/inbox', label: 'Hộp thư', icon: 'inbox' },
  { path: '/projects', label: 'Project', icon: 'folder' },
  { path: '/journal', label: 'Nhật ký', icon: 'book' },
  { path: '/reports', label: 'Báo cáo ngày', icon: 'file' },
  { path: '/stats', label: 'Thống kê', icon: 'chart' },
  { path: '/search', label: 'Tìm kiếm', icon: 'search' },
];
// Phones: four tabs and "Thêm", which lists the rest.
const TABS = ['/', '/upcoming', '/inbox', '/journal'];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, TrPipe, QuickAdd, TaskDrawer],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  readonly nav = NAV;
  readonly tabs = NAV.filter((n) => TABS.includes(n.path));
  readonly more = [...NAV.filter((n) => !TABS.includes(n.path)), { path: '/settings', label: 'Cài đặt', icon: 'settings' as IconName }];
  readonly ui = inject(UiService);
  readonly auth = inject(AuthService);
  private router = inject(Router);
  readonly day = today();
  readonly dayTitle = dayTitle(this.day);
  readonly openId = openTaskId();
  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly initial = computed(() => (this.email()[0] ?? '?').toUpperCase());

  private overdue = liveRows<Task>('tasks', () => (q) => q.is('completed_at', null).lt('due_date', this.day));
  readonly over = computed(() => this.overdue.rows().filter((t) => endDay(t)! < this.day).length);

  private url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  readonly moreActive = computed(() => this.more.some((m) => this.url().startsWith(m.path) && m.path !== '/') || this.url().startsWith('/project'));

  private addSheet = viewChild.required<ElementRef<HTMLDialogElement>>('addSheet');
  private moreSheet = viewChild.required<ElementRef<HTMLDialogElement>>('moreSheet');
  readonly adding = signal(false);

  constructor() {
    // "N" outside a field focuses the quick add (phones: opens the add sheet).
    document.addEventListener('keydown', (e) => {
      const el = e.target as HTMLElement | null;
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"], dialog[open]')) return;
      e.preventDefault();
      this.ui.focusQuickAdd();
    });
    // Any "Thêm việc" (a button, the N key): on phones that opens the add sheet; wide screens focus the top bar box.
    let first = true;
    effect(() => {
      this.ui.quickFocus();
      if (first) { first = false; return; }
      if (matchMedia('(max-width: 60rem)').matches) untracked(() => this.openAdd());
    });
    // Navigating closes the phone sheets.
    effect(() => {
      this.url();
      this.moreSheet()?.nativeElement.close();
    });
  }

  /** A detail route lights its list's item: /project/:id under Project, /report/:day under Báo cáo ngày. */
  detailOf(path: string) {
    const u = this.url();
    return (path === '/projects' && u.startsWith('/project/')) || (path === '/reports' && u.startsWith('/report/'));
  }
  openAdd() {
    this.adding.set(true);
    this.addSheet().nativeElement.showModal();
    setTimeout(() => this.addSheet().nativeElement.querySelector('input')?.focus());
  }
  closeAdd() {
    this.addSheet().nativeElement.close();
    this.adding.set(false);
  }
  openMore() {
    this.moreSheet().nativeElement.showModal();
  }
  closeMore() {
    this.moreSheet().nativeElement.close();
  }
}
