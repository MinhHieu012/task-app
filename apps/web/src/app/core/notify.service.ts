import { Injectable, signal } from '@angular/core';
import { tr } from '@core/i18n';

export type Tone = 'error' | 'success' | 'info';
/** A button on the toast, e.g. "Hoàn tác"; pressing it runs `run` and closes the toast. */
export interface ToastAction { label: string; run: () => unknown }
export interface Toast { id: number; tone: Tone; title: string; message: string; action?: ToastAction; until: number }
export interface Ask { title: string; message: string; confirmText: string; resolve: (ok: boolean) => void }

/** In-app toasts and the confirm dialog (never window.alert/confirm), drawn by <app-notifier> in the shell. */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  readonly toasts = signal<Toast[]>([]);
  readonly ask = signal<Ask | null>(null);
  private id = 0;

  /** The newest three stay; each closes itself (longer when it carries an undo) or by its close button. */
  toast(message: string, title: string, tone: Tone = 'info', action?: ToastAction) {
    // An undo stays 10 s and shows the seconds it has left (Notifier), so the user knows how long it lasts.
    const ms = action ? 10_000 : tone === 'error' ? 6000 : 4000;
    const t = { id: ++this.id, tone, title, message, action, until: Date.now() + ms };
    this.toasts.update((list) => [...list, t].slice(-3));
    setTimeout(() => this.dismiss(t.id), ms);
  }
  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
  error(message: string, title = tr('Lỗi')) {
    this.toast(message, title, 'error');
  }

  /** Asks before a destructive action; resolves true when confirmed. A second ask replaces an unanswered one. */
  confirm(title: string, message = '', confirmText = tr('Xoá')): Promise<boolean> {
    this.ask()?.resolve(false);
    return new Promise((resolve) => this.ask.set({ title, message, confirmText, resolve }));
  }
  answer(ok: boolean) {
    this.ask()?.resolve(ok);
    this.ask.set(null);
  }
}
