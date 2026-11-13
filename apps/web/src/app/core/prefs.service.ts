import { computed, effect, Injectable, Pipe, type PipeTransform, signal } from '@angular/core';
import { DEFAULT_ACCENT, isHex } from '@core/accent';
import { getLang, type Lang, tr } from '@core/i18n';

import { palette, projectColors } from './theme/palette';

export type Theme = 'light' | 'dark' | 'system';

/** localStorage, which can throw (private mode, blocked storage): fall back to defaults. */
export function getPref(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function setPref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* blocked storage: the choice lasts this visit */ }
}

/** Device-local settings, shared with nothing (same keys as the old web app, so a returning browser keeps them).
 *  Theme and accent apply at once; the language reloads the page, since strings are translated as they render. */
@Injectable({ providedIn: 'root' })
export class PrefsService {
  readonly theme = signal<Theme>((getPref('theme') as Theme | null) ?? 'light');
  readonly accent = signal(isHex(getPref('accent') ?? '') ? getPref('accent')!.toLowerCase() : DEFAULT_ACCENT);
  readonly lang: Lang = getLang();
  private systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => this.theme() === 'dark' || (this.theme() === 'system' && this.systemDark()));
  readonly projectColors = computed(() => projectColors(this.accent(), this.dark()));

  constructor() {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      const root = document.documentElement;
      for (const [k, v] of Object.entries(palette(this.accent(), this.dark()))) root.style.setProperty(k, v);
      root.dataset['theme'] = this.dark() ? 'dark' : 'light';
      this.drawFavicon();
    });
  }

  setTheme(t: Theme) {
    this.theme.set(t);
    setPref('theme', t);
  }
  setAccent(hex: string) {
    this.accent.set(hex.toLowerCase());
    setPref('accent', hex.toLowerCase());
  }
  setLang(l: Lang) {
    setPref('lang', l);
    window.location.reload();
  }

  projectColor(i: number) {
    const c = this.projectColors();
    return c[Math.max(i, 0) % c.length];
  }

  /** The tab icon in the current accent: the app mark (two ticks) on an accent tile. */
  private drawFavicon() {
    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue('--color-accent').trim();
    const fg = css.getPropertyValue('--color-accent-ink').trim();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="144" fill="${bg}"/><g transform="translate(97 97) scale(0.62)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M236 330L266 360L444 150" stroke="${fg}" stroke-width="46"/><path d="M70 270L160 360L338 150" stroke="${bg}" stroke-width="98"/><path d="M70 270L160 360L338 150" stroke="${fg}" stroke-width="46"/></g></svg>`;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
}

/** `{{ 'Hôm nay' | tr }}`, `{{ 'Còn {n} việc' | tr: { n } }}`. Pure: the language never changes while the page runs. */
@Pipe({ name: 'tr' })
export class TrPipe implements PipeTransform {
  transform(key: string, vars?: Record<string, string | number>) {
    return tr(key, vars);
  }
}
