import { bootstrapApplication } from '@angular/platform-browser';
import { getLang, setLang } from '@core/i18n';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { getPref } from './app/core/prefs.service';

// Before the first render: strings are translated as they render, and a language change reloads the page.
setLang(getPref('lang'));
document.documentElement.lang = getLang();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
