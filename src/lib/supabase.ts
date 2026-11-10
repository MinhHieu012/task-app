import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type PostgrestFilterBuilder, type Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

import { tr } from './i18n';
import { showError } from './notify';
import { tagCounts } from './tags';

export type Project = { id: string; name: string; created_at: string };
export type Task = {
  id: string;
  project_id: string | null;
  title: string;
  note: string | null;
  priority: number;
  due_date: string | null;
  due_time: string | null; // start time
  end_date: string | null;
  end_time: string | null;
  repeat: string | null;
  completed_at: string | null;
  completed_day: string | null;
  recurring_copy: boolean;
  tags: string[]; // lowercase, without '#'
  created_at: string;
};
export type Report = {
  id: string;
  day: string;
  content: string; // HTML
  body: string; // plain text, for search
  late: boolean;
  done_count: number;
  missed_count: number;
  submitted_at: string;
  updated_at: string;
};
export type JournalNote = { id: string; day: string; body: string; updated_at: string };
export type Subtask ={ id: string; task_id: string; title: string; done: boolean; start_date: string | null; start_time: string | null; end_date: string | null; end_time: string | null; created_at: string };

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_KEY!, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    // PKCE: a URL only signs in if this browser started the flow (holds the code verifier). The implicit default
    // accepted any #access_token=… link, so a crafted link could silently swap the user into another account.
    flowType: 'pkce',
  },
});

// A reset link that worked: Supabase says so once, with PASSWORD_RECOVERY, while it reads the link. Subscribed
// here, right after createClient, so the event fired during startup is not missed. A used or expired link fires
// nothing (and keeps any existing session), so /reset-password must check this, not just "is there a session".
let recovery = false;
const recoveryListeners = new Set<() => void>();
const setRecovery = (on: boolean) => {
  recovery = on;
  recoveryListeners.forEach((l) => l());
};
supabase.auth.onAuthStateChange((event) => event === 'PASSWORD_RECOVERY' && setRecovery(true));
const subscribeRecovery = (l: () => void) => {
  recoveryListeners.add(l);
  return () => { recoveryListeners.delete(l); };
};

/** True after a valid reset link, until the new password is saved (endRecovery): one link, one change. */
export const useRecovery = () => useSyncExternalStore(subscribeRecovery, () => recovery);
export const endRecovery = () => setRecovery(false);

// Refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (s) =>
  s === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh(),
);

// Supabase auth errors arrive in English whatever the app language; the common ones by code, through tr().
// Vietnamese keys (with their English in i18n.ts), read at call time since tr must not run at module level.
const AUTH_ERRORS: Record<string, string> = {
  same_password: 'Mật khẩu mới phải khác mật khẩu cũ.',
  invalid_credentials: 'Email hoặc mật khẩu chưa đúng.',
  email_not_confirmed: 'Email chưa được xác nhận. Mở link trong email trước rồi đăng nhập.',
  user_already_exists: 'Email này đã có tài khoản. Hãy đăng nhập.',
  email_exists: 'Email này đã có tài khoản. Hãy đăng nhập.',
  weak_password: 'Mật khẩu quá yếu. Chọn mật khẩu dài hơn hoặc khó đoán hơn.',
  email_address_invalid: 'Email chưa đúng dạng.',
  over_email_send_rate_limit: 'Đã gửi quá nhiều email trong một giờ. Đợi một lúc rồi thử lại.',
  over_request_rate_limit: 'Thử quá nhiều lần. Đợi một lúc rồi thử lại.',
  otp_expired: 'Link đã hết hạn hoặc được mở trên máy khác. Gửi lại link từ màn đăng nhập.',
  signup_disabled: 'Hiện chưa mở đăng ký tài khoản mới.',
  identity_already_exists: 'Tài khoản Google này đã gắn với một tài khoản khác.',
  manual_linking_disabled: 'Chưa bật liên kết tài khoản trong Supabase (Allow manual linking).',
  provider_disabled: 'Chưa bật đăng nhập Google trong Supabase.',
  access_denied: 'Bạn đã huỷ đăng nhập Google.',
  single_identity_not_deletable: 'Đây là cách đăng nhập duy nhất của tài khoản nên chưa gỡ được.',
};

/** Where an auth email or OAuth round trip comes back to; it must be in Supabase's Redirect URLs, else Supabase
 *  silently sends the user to the Site URL (the web app) instead. Native: the bare scheme, not Linking.createURL,
 *  which adds the dev server host (taskapp://192.168.1.5:8081/) and so never matched the list. */
export const authRedirect = (path: string) => (Platform.OS === 'web' ? `${window.location.origin}${path}` : `taskapp://${path.replace(/^\//, '')}`);

/** Google sign-in (`link` false) or linking Google to the signed-in account (`link` true), so it can sign in
 *  later. Web leaves the page for Google and comes back to `path`; the client trades the ?code= itself
 *  (detectSessionInUrl). Native opens an auth browser and trades the code here. Same-email accounts are
 *  linked by Supabase on its own; `link` is for a Google account with another email. */
export async function google(link: boolean, path = '/') {
  const web = Platform.OS === 'web';
  const redirectTo = authRedirect(path);
  const options = { redirectTo, skipBrowserRedirect: !web };
  const res = link ? await supabase.auth.linkIdentity({ provider: 'google', options }) : await supabase.auth.signInWithOAuth({ provider: 'google', options });
  if (!ok(res) || web || !res.data.url) return;
  const back = await WebBrowser.openAuthSessionAsync(res.data.url, redirectTo);
  if (back.type !== 'success') return; // closed by the user
  const q = urlParams(back.url);
  const code = q.get('code');
  if (code) ok(await supabase.auth.exchangeCodeForSession(code));
  else authUrlError(back.url);
  if (link) supabase.auth.refreshSession(); // the new identity shows in the user only after a refresh
}

const urlParams = (url: string) => new URLSearchParams(url.split(/[?#]/).slice(1).join('&'));
/** Supabase reports a failed OAuth round trip in the URL it sends back (error_code=…), not as a thrown error. */
const authUrlError = (url: string) => {
  const q = urlParams(url);
  const code = q.get('error_code') ?? q.get('error');
  if (code) ok({ error: { code, message: q.get('error_description') ?? code } });
};
// Web: the redirect back from Google lands as a fresh page load. Later, so tr and the toasts are ready.
if (Platform.OS === 'web' && typeof window !== 'undefined' && /[?&#]error/.test(window.location.href)) {
  const url = window.location.href;
  window.history.replaceState(null, '', window.location.pathname); // a reload must not show it again
  setTimeout(() => authUrlError(url));
}

/** Surfaces a Supabase error on web and native; returns true on success. */
export function ok({ error }: { error: { message: string; code?: string } | null }) {
  if (error) showError(error.code && AUTH_ERRORS[error.code] ? tr(AUTH_ERRORS[error.code]) : error.message);
  return !error;
}

/** undefined while loading, null when signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null>();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

type Query = PostgrestFilterBuilder<any, any, any, any[], string, unknown, 'GET'>;

// Mounted useRows loaders per table, so a write can refresh every screen at once.
const loaders = new Map<string, Set<() => unknown>>();

/** Reloads every mounted useRows of `table` now. Call after a write: realtime can arrive late or not at all
 *  (e.g. a subscription opened before the table existed), and the user should see their own change at once. */
export const refresh = (table: string) => loaders.get(table)?.forEach((l) => l());

/**
 * Rows of a table (RLS scopes them to the user), kept live by realtime and by refresh() after own writes.
 * `filter` narrows/orders the select; `key` must change whenever `filter` does.
 */
export function useRows<T>(table: string, filter: (q: Query) => Query = (q) => q, key = '') {
  const [rows, setRows] = useState<T[]>();
  const load = useCallback(
    () =>
      filter(supabase.from(table).select('*') as Query)
        .then((res) => {
          setRows((prev) => (ok(res) ? (res.data as T[]) : (prev ?? [])));
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, key],
  );

  useEffect(() => {
    load();
    if (!loaders.has(table)) loaders.set(table, new Set());
    loaders.get(table)!.add(load);
    // ponytail: refetches the whole query on any change to the table; fine for one user's rows.
    const channel = supabase
      .channel(`rows:${table}:${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe();
    return () => {
      loaders.get(table)!.delete(load);
      supabase.removeChannel(channel);
    };
  }, [load, table]);

  return [rows ?? [], load, rows !== undefined] as const; // [rows, reload, loaded]
}

/** Tags already in use, most used first (task form chips, quick add suggestions). Done copies of recurring tasks
 *  are skipped so one task doesn't count many times. ponytail: reads every tagged task; a tags view if that grows. */
export function useKnownTags() {
  const [tagged] = useRows<Task>('tasks', (q) => q.neq('tags', '{}'), 'tagged');
  return tagCounts(tagged.filter((t) => !t.recurring_copy)).map(([t]) => t);
}
