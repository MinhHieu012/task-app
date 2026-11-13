import { type ApplicationConfig, inject, Injectable, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { provideRouter, type RouterStateSnapshot, TitleStrategy, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { tr } from '@core/i18n';

import { routes } from './app.routes';

/** Route titles are tr() keys: translated when the route is entered (tr must not run at module level). */
@Injectable()
class TrTitle extends TitleStrategy {
  private readonly title = inject(Title);
  override updateTitle(state: RouterStateSnapshot) {
    const t = this.buildTitle(state);
    this.title.setTitle(t ? `${tr(t)} · ${tr('Việc & Nhật ký')}` : tr('Việc & Nhật ký'));
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    { provide: TitleStrategy, useClass: TrTitle },
  ],
};
