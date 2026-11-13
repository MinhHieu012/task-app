// The colour tokens for a theme and an accent, as CSS custom properties. Same recipe as the mobile theme
// (apps/mobile/src/constants/theme.ts): warm neutrals tuned for terracotta, turned to the accent's hue, and an
// accent darkened (light) or lightened (dark) until text on it reads at 4.5:1. Applied to :root at startup
// and whenever Settings changes, so a new accent or theme shows at once (the mobile app reloads instead).
import { accentTokens, DARK_SURFACE, neutral } from '@core/accent';

export function palette(accentHex: string, dark: boolean): Record<string, string> {
  const a = accentTokens(accentHex, dark);
  const n = (hex: string) => neutral(hex, a.primary);
  const d = (light: string, night: string) => (dark ? night : light);
  return {
    '--color-accent': a.primary,
    '--color-accent-hover': a.hover,
    '--color-accent-ink': d('#ffffff', DARK_SURFACE),
    '--color-accent-wash': a.light,
    '--color-focus': a.primary,
    '--color-bar': a.bar,
    '--color-bar-hover': a.barHover,

    '--color-paper': n(d('#f6f3ee', '#1a1815')),
    '--color-sheet': n(d('#ffffff', DARK_SURFACE)),
    '--color-paper-2': n(d('#efeae2', '#1f1d1a')),
    '--color-paper-3': n(d('#e6dfd4', '#3a3631')),
    '--color-field': n(d('#ffffff', '#2a2723')),
    '--color-ink': n(d('#23211d', '#f2ede6')),
    '--color-ink-2': n(d('#3f3b35', '#d8d1c6')),
    '--color-muted': n(d('#6b645a', '#a89f92')),
    '--color-rule': n(d('#ebe5db', '#35312c')),
    '--color-rule-strong': n(d('#ddd5c8', '#45403a')),
    '--color-edge': n(d('#948b7e', '#7a7166')),
    '--color-hover': n(d('#f6f1ea', '#2d2a26')),
    '--color-chip': n(d('#f3eee6', '#2f2b27')),
    '--color-backdrop': d('rgba(35,33,29,0.4)', 'rgba(0,0,0,0.6)'),

    '--color-danger': d('#b42318', '#f28b7d'),
    '--color-danger-wash': d('#fdecea', '#3b211d'),
    '--color-success': d('#1f7a45', '#6fcf97'),
    '--color-success-wash': d('#e5f4ea', '#1b3325'),
    '--color-warning': d('#9a5b00', '#e9b35c'),
    '--color-warning-wash': d('#fdf1dc', '#3a2d16'),
    '--color-error': d('#b42318', '#f28b7d'),

    '--color-p1': d('#b42318', '#f28b7d'),
    '--color-p2': d('#b26a00', '#e9a54a'),
    '--color-p3': d('#2563b0', '#7fb0ea'),
    '--color-p4': n(d('#8a8378', '#8f877c')),

    '--shadow-float': d('0 12px 32px rgba(35,33,29,0.12)', '0 12px 32px rgba(0,0,0,0.5)'),
    '--shadow-raised': d('0 1px 2px rgba(35,33,29,0.12)', '0 1px 2px rgba(0,0,0,0.5)'),
  };
}

/** Project marks by position in the name-sorted list; the first follows the accent. All >= 3:1 on the sheet. */
export function projectColors(accentHex: string, dark: boolean) {
  const a = accentTokens(accentHex, dark).primary;
  const fixed = dark
    ? ['#e48a66', '#e9a54a', '#6fcf97', '#7fb0ea', '#d68bb8', '#a89f92']
    : ['#b04a24', '#b26a00', '#1f7a45', '#2563b0', '#8e3b6e', '#6b645a'];
  return [a, ...fixed.filter((c) => c !== a)].slice(0, 6);
}
