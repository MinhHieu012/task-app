import { computed, inject, Injectable, signal } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import type { Session } from '@supabase/supabase-js';

import { SupabaseService } from './supabase.service';

/** The session as a signal: undefined while the stored one is read, null when signed out. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private sb = inject(SupabaseService).client;
  readonly session = signal<Session | null | undefined>(undefined);
  readonly user = computed(() => this.session()?.user ?? null);
  /** True after a valid reset link (Supabase says so once, with PASSWORD_RECOVERY), until the new password is
   *  saved. A used or expired link fires nothing, so /reset-password checks this, not just "is there a session". */
  readonly recovering = signal(false);
  /** Resolves once the stored session is known, so guards never flash sign-in for a signed-in user. */
  readonly ready: Promise<void>;

  constructor() {
    // Subscribed in the constructor, right after the client exists, so the recovery event fired while the client
    // reads the URL at startup is not missed.
    this.sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') this.recovering.set(true);
      this.session.set(s);
    });
    this.ready = this.sb.auth.getSession().then(({ data }) => this.session.set(data.session));
  }
}

const gate = (want: boolean, elsewhere: string): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return !!auth.session() === want || router.parseUrl(elsewhere);
};

/** Signed-in screens. */
export const signedIn = gate(true, '/sign-in');
/** The sign-in screen: a signed-in user goes home. */
export const signedOut = gate(false, '/');
