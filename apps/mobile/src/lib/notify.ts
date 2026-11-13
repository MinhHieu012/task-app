// In-app toasts and confirm dialog instead of window.alert/confirm (web) and Alert.alert (native), so they
// match the app's look on every platform. Callers stay imperative; <Notifier /> in the root layout draws them.

import { tr } from './i18n.ts';

export type Tone = 'error' | 'success' | 'info';
/** A button on the toast, e.g. "Hoàn tác"; pressing it runs `run` and closes the toast. */
export type ToastAction = { label: string; run: () => unknown };
export type Toast = { id: number; tone: Tone; title: string; message: string; action?: ToastAction };
type Ask = { title: string; message: string; confirmText: string; resolve: (ok: boolean) => void };
/** One line of a menu: `key` comes back from choose(). `on` marks the current value with a tick. */
export type Choice = { key: string; label: string; icon?: string; tint?: string; danger?: boolean; on?: boolean; detail?: string };
type Menu = { title: string; message: string; choices: Choice[]; resolve: (key: string | null) => void };
// `ask` outlives `asking` (and `menu` outlives `menuOpen`) so each keeps its text while it animates out.
type State = { toasts: Toast[]; ask: Ask | null; asking: boolean; menu: Menu | null; menuOpen: boolean };

let state: State = { toasts: [], ask: null, asking: false, menu: null, menuOpen: false };
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

/** Phones: a menu as an action sheet (long press on a task, a screen's ⋯). Resolves the picked key, or null. */
export function choose(title: string, choices: Choice[], message = ''): Promise<string | null> {
  state.menu?.resolve(null);
  return new Promise((resolve) => emit({ menu: { title, message, choices, resolve }, menuOpen: true }));
}
export function picked(key: string | null) {
  const m = state.menu;
  emit({ menuOpen: false });
  m?.resolve(key);
}
