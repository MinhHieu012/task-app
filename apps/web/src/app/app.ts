import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';
import { PrefsService } from './core/prefs.service';
import { Notifier } from './shared/notifier';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Notifier],
  template: '<router-outlet /><app-notifier />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    inject(PrefsService); // applies the theme and accent before the first screen
    const auth = inject(AuthService);
    const router = inject(Router);
    // Signing out anywhere (button, expired or revoked session, another tab) returns to sign-in; signing in
    // (password, or the OAuth redirect) leaves it. The reset page handles its own session.
    effect(() => {
      const s = auth.session();
      if (s === undefined) return;
      // The address bar, not router.url: on a deep link the first navigation may not have finished yet, and
      // router.url still reads '/', which sent a signed-out /reset-password visit to sign-in.
      const path = window.location.pathname;
      if (!s && !['/sign-in', '/reset-password', '/design-system'].includes(path)) router.navigateByUrl('/sign-in');
      if (s && path === '/sign-in') router.navigateByUrl('/');
    });
  }
}
