// In-app toasts and confirm dialog instead of window.alert/confirm (web) and Alert.alert (native), so they
// match the app's look on every platform. Callers stay imperative; <Notifier /> in the root layout draws them.

import { tr } from './i18n.ts';

export type Tone = 'error' | 'success' | 'info';
/** A button on the toast, e.g. "Hoàn tác"; pressing it runs `run` and closes the toast. */
export type ToastAction = { label: string; run: () => unknown };
export type Toast = { id: number; tone: Tone; title: string; message: string; action?: ToastAction };
type Ask = { title: string; message: string; confirmText: string; resolve: (ok: boolean) => void };
// `ask` outlives `asking` so the dialog keeps its text while it animates out.
type State = { toasts: Toast[]; ask: Ask | null; asking: boolean };

let state: State = { toasts: [], ask: null, asking: false };
const listeners = new Set<() => void>();
const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

/** For useSyncExternalStore. */
export const notifyStore = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  get: () => state,
};

let nextId = 0;
/** Shows a toast; the newest three stay on screen. It closes itself (see Notifier) or via its close button. */
export function toast(message: string, title: string, tone: Tone = 'info', action?: ToastAction) {
  emit({ toasts: [...state.toasts, { id: ++nextId, tone, title, message, action }].slice(-3) });
}
export const dismissToast = (id: number) => emit({ toasts: state.toasts.filter((t) => t.id !== id) });

export const showError = (message: string, title = tr('Lỗi')) => toast(message, title, 'error');

/** Asks before a destructive action; resolves true when the user confirms. */
export function confirmAction(title: string, message = '', confirmText = tr('Xoá')): Promise<boolean> {
  state.ask?.resolve(false); // a second ask replaces an unanswered one
  return new Promise((resolve) => emit({ ask: { title, message, confirmText, resolve }, asking: true }));
}
export function answer(ok: boolean) {
  state.ask?.resolve(ok);
  emit({ asking: false });
}
