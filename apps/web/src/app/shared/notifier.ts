import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';

import { NotifyService, type Toast } from '../core/notify.service';
import { TrPipe } from '../core/prefs.service';
import { Icon } from './icon';

/** Toasts (bottom right, newest last, with an optional undo) and the confirm dialog. The dialog is a native
 *  <dialog> opened modally: it traps focus, Esc cancels, and focus returns to the control that asked. */
@Component({
  selector: 'app-notifier',
  imports: [Icon, TrPipe],
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of notify.toasts(); track t.id) {
        <div class="toast" [class]="t.tone" [attr.role]="t.tone === 'error' ? 'alert' : 'status'">
          <app-icon [name]="t.tone === 'error' ? 'alert' : t.tone === 'success' ? 'circle-check' : 'info'" [size]="18" />
          <div class="grow">
            <p class="t-title">{{ t.title }}</p>
            @if (t.message) { <p class="t-msg">{{ t.message }}</p> }
          </div>
          @if (t.action) { <button type="button" class="btn btn-sm" (click)="run(t)"><app-icon name="undo" [size]="16" />{{ t.action.label }} <span class="num muted">{{ left(t) }}s</span></button> }
          <button type="button" class="btn btn-icon btn-sm" (click)="notify.dismiss(t.id)" [attr.aria-label]="'Đóng' | tr"><app-icon name="x" [size]="16" /></button>
        </div>
      }
    </div>

    <dialog #dialog class="dialog" aria-labelledby="ask-title" (cancel)="$event.preventDefault(); notify.answer(false)">
      @if (notify.ask(); as a) {
        <h2 id="ask-title">{{ a.title }}</h2>
        @if (a.message) { <p class="muted">{{ a.message }}</p> }
        <div class="actions">
          <button type="button" class="btn btn-ghost" (click)="notify.answer(false)">{{ 'Huỷ' | tr }}</button>
          <button type="button" class="btn btn-danger" (click)="notify.answer(true)">{{ a.confirmText }}</button>
        </div>
      }
    </dialog>
  `,
  styles: `
    .toasts { position: fixed; right: 24px; bottom: 24px; z-index: var(--z-toast); display: flex; flex-direction: column; gap: 8px; width: min(400px, calc(100vw - 32px)); }
    .toast { display: flex; align-items: flex-start; gap: 12px; padding: 12px 8px 12px 14px; background: var(--color-sheet); border: var(--rule-hair) solid var(--color-rule);
      border-radius: var(--radius-card); box-shadow: var(--shadow-float); animation: rise var(--dur-short) var(--ease-out); }
    .toast > app-icon { margin-top: 2px; color: var(--color-accent); }
    .toast.error > app-icon { color: var(--color-danger); }
    .toast.success > app-icon { color: var(--color-success); }
    .t-title { font-weight: 600; font-size: var(--text-sm); }
    .t-msg { font-size: var(--text-sm); color: var(--color-muted); overflow-wrap: anywhere; }
    .dialog { width: min(440px, calc(100vw - 32px)); padding: 24px; border: 0; border-radius: var(--radius-sheet); background: var(--color-sheet); color: var(--color-ink); box-shadow: var(--shadow-float); }
    .dialog:focus-visible { outline: none; }
    .dialog[open] { animation: rise var(--dur-short) var(--ease-out); }
    .dialog::backdrop { background: var(--color-backdrop); }
    .dialog p { margin-top: 8px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
    @media (max-width: 60rem) { .toasts { right: 16px; left: 16px; width: auto; bottom: 88px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notifier {
  readonly notify = inject(NotifyService);
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private now = signal(Date.now());

  constructor() {
    // A clock for the undo countdown; it only ticks while a toast with an action is up.
    setInterval(() => { if (this.notify.toasts().some((t) => t.action)) this.now.set(Date.now()); }, 1000);
    effect(() => {
      const d = this.dialog().nativeElement;
      if (this.notify.ask() && !d.open) {
        d.showModal();
        // Focus the safe choice, not the dialog box, so Enter never deletes by accident.
        setTimeout(() => d.querySelector<HTMLButtonElement>('.btn-ghost')?.focus());
      }
      else if (!this.notify.ask() && d.open) d.close();
    });
  }

  left(t: Toast) {
    return Math.max(0, Math.ceil((t.until - this.now()) / 1000));
  }

  run(t: Toast) {
    this.notify.dismiss(t.id);
    t.action!.run();
  }
}
