import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type PostgrestFilterBuilder, type Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { showError } from './notify';

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
  created_at: string;
};

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_KEY!, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (s) =>
  s === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh(),
);

/** Surfaces a Supabase error on web and native; returns true on success. */
export function ok({ error }: { error: { message: string } | null }) {
  if (error) showError(error.message);
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

/**
 * Rows of a table (RLS scopes them to the user), kept live by realtime.
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
    // ponytail: refetches the whole query on any change to the table; fine for one user's rows.
    const channel = supabase
      .channel(`rows:${table}:${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, table]);

  return [rows ?? [], load, rows !== undefined] as const; // [rows, reload, loaded]
}
