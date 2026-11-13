import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { tr } from '@core/i18n';
import { map } from 'rxjs';
import type { Task } from '@core/types';

export interface QuickContext {
  /** Taken at submit time, so values like "now" are fresh. */
  defaults: () => Partial<Task>;
  /** A tr() key and its vars. */
  placeholder: [string, Record<string, string | number>?];
  /** The Journal logs work already done; the quick add says so. */
  label?: string;
}

const INBOX: QuickContext = { defaults: () => ({}), placeholder: ['Thêm vào Hộp thư…'] };

/** Shell-wide UI state: which task is open (the ?task= query param) and what the one quick add box adds to. */
@Injectable({ providedIn: 'root' })
export class UiService {
  private router = inject(Router);
  readonly quick = signal<QuickContext>(INBOX);
  readonly quickFocus = signal(0); // bumped by "N" and "Thêm việc" buttons

  /** Opens the task in the side drawer, keeping the page under it; the URL can be shared or reloaded. */
  openTask(id: string | null) {
    this.router.navigate([], { queryParams: { task: id }, queryParamsHandling: 'merge' });
  }
  focusQuickAdd() {
    this.quickFocus.update((n) => n + 1);
  }
  placeholder() {
    const [key, vars] = this.quick().placeholder;
    return tr(key, vars);
  }
}

/** A page's quick add context while it is on screen; the Inbox default comes back when it leaves. */
export function useQuickAdd(ctx: () => QuickContext) {
  const ui = inject(UiService);
  inject(DestroyRef).onDestroy(() => ui.quick.set(INBOX));
  effect(() => ui.quick.set(ctx()));
}

/** The current ?task= id, for pages that tint the open row. */
export function openTaskId() {
  return toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('task'))), { initialValue: null });
}
