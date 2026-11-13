import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { SupabaseService } from './supabase.service';

export type Table = 'tasks' | 'projects' | 'subtasks' | 'daily_reports' | 'journal_notes';
// The select builder of supabase-js; its generic chain is not worth spelling out for one user's untyped schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Query = any;

/** Open queries per table, and one realtime channel per table while any query of it is open. */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private sb = inject(SupabaseService);
  private loaders = new Map<Table, Set<() => void>>();
  private channels = new Map<Table, RealtimeChannel>();

  /** Reloads every open query of `table` now. Call after a write: realtime can arrive late or not at all, and
   *  the user should see their own change at once. */
  refresh(...tables: Table[]) {
    for (const t of tables) this.loaders.get(t)?.forEach((l) => l());
  }

  register(table: Table, load: () => void) {
    if (!this.loaders.has(table)) this.loaders.set(table, new Set());
    const set = this.loaders.get(table)!;
    set.add(load);
    if (!this.channels.has(table)) {
      // ponytail: any change to the table refetches its open queries; fine for one user's rows.
      const ch = this.sb.client
        .channel(`live:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => this.refresh(table))
        .subscribe();
      this.channels.set(table, ch);
    }
    return () => {
      set.delete(load);
      if (!set.size) {
        const ch = this.channels.get(table);
        if (ch) this.sb.client.removeChannel(ch);
        this.channels.delete(table);
      }
    };
  }
}

export interface Rows<T> {
  /** The rows; while a new query loads, the previous rows stay on screen (no flash). */
  rows: () => T[];
  /** False until the current query has answered (a screen must not read the old rows as the new ones). */
  loaded: () => boolean;
  /** The last load failed (the toast already said why); the rows are what was there before. */
  failed: () => boolean;
}

/**
 * Rows of a table (RLS scopes them to the user), kept live. `query` builds the select from signals: whenever a
 * signal it reads changes, the query reruns; return null to load nothing. Call in an injection context.
 */
export function liveRows<T>(table: Table, query: () => ((q: Query) => Query) | null = () => (q) => q): Rows<T> {
  const live = inject(LiveService);
  const sb = inject(SupabaseService);
  const rows = signal<T[]>([]);
  const loaded = signal(false);
  const failed = signal(false);
  let run = 0;

  effect((onCleanup) => {
    const build = query();
    const mine = ++run; // an answer for a query we have left must not land after the new one
    loaded.set(false);
    if (!build) {
      rows.set([]);
      loaded.set(true);
      return;
    }
    const load = () =>
      untracked(() =>
        build(sb.client.from(table).select('*')).then((res: { data: T[] | null; error: { message: string } | null }) => {
          if (mine !== run) return;
          failed.set(!!res.error);
          if (sb.ok(res)) rows.set(res.data ?? []);
          loaded.set(true);
        }),
      );
    load();
    onCleanup(live.register(table, load));
  });

  return { rows: rows.asReadonly(), loaded: loaded.asReadonly(), failed: failed.asReadonly() };
}
