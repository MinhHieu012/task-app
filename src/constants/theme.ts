// Hallmark redesign (2026-11-09), softened the same day: Almanac's structure (ruled sheets, tables, tabular
// figures) in a warmer material. Cream stock, white sheets, warm ink, soft rounded corners, light rules, one
// terracotta accent for the primary action and the current selection only. The slate/ink/square version read cold.
// Every text colour passes 4.5:1 on the sheet; priority 2 and 4 text sits a step darker than their marks.
// Be Vietnam Pro stays the one family: it has full Vietnamese glyphs (DM Sans broke them). Loaded in src/app/_layout.tsx.
import { Appearance } from 'react-native';

import { accentTokens, DARK_SURFACE, DEFAULT_ACCENT, neutral } from '@/lib/accent';
import { getPref } from '@/lib/prefs';

export const font = 'Be Vietnam Pro';

// Light / dark / system, from Settings. Like the accent it is read once before any StyleSheet is built, so
// Light until the user picks otherwise. 'system' follows the OS theme as of launch (a switch while the app runs shows after the next start).
const mode = getPref('theme') ?? 'light';
export const dark = mode === 'dark' || (mode === 'system' && Appearance.getColorScheme() === 'dark');
/** Light value, or its dark-theme twin. */
const d = <T,>(light: T, night: T) => (dark ? night : light);

// The accent is the user's pick from Settings (default terracotta), read before any StyleSheet is built.
const accent = accentTokens(getPref('accent') ?? DEFAULT_ACCENT, dark);
// Warm neutrals follow the accent's hue (unchanged for the default), so a blue accent doesn't sit on yellow cream.
const n = (hex: string) => neutral(hex, accent.primary);

export const color = {
  primary: accent.primary,
  primaryHover: accent.hover,
  primaryFg: d('#ffffff', DARK_SURFACE), // dark: the accent is lightened, so it carries dark text
  primaryLight: accent.light, // selection wash
  ringFocus: accent.primary, // focus ring, drawn as an outline

  background: n(d('#f6f3ee', '#1a1815')), // cream stock
  surface: n(d('#ffffff', DARK_SURFACE)), // the sheet
  rail: n(d('#efeae2', '#1f1d1a')),
  field: n(d('#ffffff', '#2a2723')),
  foreground: n(d('#23211d', '#f2ede6')), // warm ink
  soft: n(d('#3f3b35', '#d8d1c6')),
  muted: n(d('#6b645a', '#a89f92')),
  border: n(d('#ebe5db', '#35312c')), // hairline rule
  borderStrong: n(d('#ddd5c8', '#45403a')), // the rule under a head
  fieldEdge: n(d('#948b7e', '#7a7166')), // input edge, 3:1 on the sheet
  itemHover: n(d('#f6f1ea', '#2d2a26')),
  secondary: n(d('#efeae2', '#2f2b27')),
  secondaryHover: n(d('#e6dfd4', '#3a3631')),
  buttonHover: n(d('#f6f1ea', '#2d2a26')),
  ghostHover: n(d('#f3eee6', '#2f2b27')),
  chip: n(d('#f3eee6', '#2f2b27')),
  chipHover: n(d('#ebe5db', '#3a3631')),
  chipText: n(d('#3f3b35', '#d8d1c6')),
  backdrop: d('rgba(35,33,29,0.4)', 'rgba(0,0,0,0.6)'),
  skeleton: n(d('#efeae2', '#2f2b27')),
  chartBar: accent.bar, // a tint of the accent, so data reads while the selected day stays the strongest
  chartBarHover: accent.barHover,
  scrollbar: d('rgba(35,33,29,0.22)', 'rgba(242,237,230,0.22)'),

  danger: d('#b42318', '#f28b7d'),
  dangerBg: d('#fdecea', '#3b211d'),
  dangerBgHover: d('#fadcd8', '#4a2823'),
  error: d('#b42318', '#f28b7d'),
  errorRing: d('#b42318', '#f28b7d'),
  errorText: d('#b42318', '#f28b7d'),
  errorBg: d('#fdecea', '#3b211d'),
  errorStrong: d('#912018', '#f6a99e'),
  successBg: d('#e5f4ea', '#1b3325'),
  success: d('#1f7a45', '#6fcf97'),
  warningBg: d('#fdf1dc', '#3a2d16'),
  warning: d('#9a5b00', '#e9b35c'),
  infoBg: d('#e6eef9', '#1c2a3d'),
  neutralBg: n(d('#f3eee6', '#2f2b27')),
  neutral: n(d('#3f3b35', '#d8d1c6')),
};

// Priority scale: ticks, choice marks and the priority tag.
export const priority = d({ 1: '#b42318', 2: '#b26a00', 3: '#2563b0', 4: n('#8a8378') }, { 1: '#f28b7d', 2: '#e9a54a', 3: '#7fb0ea', 4: n('#8f877c') });
export const priorityBg = d({ 1: '#fdecea', 2: '#fdf1dc', 3: '#e6eef9', 4: n('#f3eee6') }, { 1: '#3b211d', 2: '#3a2d16', 3: '#1c2a3d', 4: n('#2f2b27') });
export const priorityText = d({ 1: '#b42318', 2: '#9a5b00', 3: '#2563b0', 4: n('#6b645a') }, { 1: '#f28b7d', 2: '#e9b35c', 3: '#7fb0ea', 4: n('#a89f92') });
export type Priority = keyof typeof priority;

// Soft corners: controls 10, sheets 14. `full` for round ticks, pills and the avatar.
export const radius = { sm: 6, ctl: 10, md: 12, lg: 14, full: 9999 } as const;
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 } as const;
// Two rule weights: a hairline between rows, a slightly firmer light line under a head.
export const rule = { hair: 1, bar: 2 } as const;

// Heads one weight (600), tightened; body at 16. Figures use tabular numerals (`num`).
export const text = {
  h1: { fontFamily: font, fontSize: 30, lineHeight: 38, fontWeight: '600', letterSpacing: -0.6 },
  h2: { fontFamily: font, fontSize: 18, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2 },
  xl: { fontFamily: font, fontSize: 20, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3 },
  lg: { fontFamily: font, fontSize: 18, lineHeight: 26, fontWeight: '600' },
  base: { fontFamily: font, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  body: { fontFamily: font, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  sm: { fontFamily: font, fontSize: 14, lineHeight: 20 },
  smMedium: { fontFamily: font, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  meta: { fontFamily: font, fontSize: 13, lineHeight: 18 },
  xs: { fontFamily: font, fontSize: 12, lineHeight: 16 },
} as const;
export const num = { fontVariant: ['tabular-nums'] } as { fontVariant: ['tabular-nums'] };

// Motion is state only: colour and opacity, short. Enter = ease-out, exit = ease-in (see `animate` in ui.tsx).
export const duration = { press: 120, fast: 150, base: 200, modal: 220, panel: 260, toast: 300 } as const;
export const easeCss = 'cubic-bezier(0.33, 1, 0.68, 1)'; // web CSS transitions, same curve as Easing.out(Easing.cubic)

// One soft shadow for things that float above the page (dialogs, toasts); sheets stay flat.
export const shadowModal = d('0 12px 32px rgba(35,33,29,0.12)', '0 12px 32px rgba(0,0,0,0.5)');
export const shadowPrimary = 'none';
// The selected tab of a segmented control: lifted just off its rail.
export const shadowRaised = d('0 1px 2px rgba(35,33,29,0.12)', '0 1px 2px rgba(0,0,0,0.5)');

// Project marks, picked by the project's position in the name-sorted list. All >= 3:1 on the sheet.
// The first follows the user's accent; a fixed mark equal to it is dropped so two projects never share it.
export const projectColors = [
  accent.primary,
  ...d(['#b04a24', '#b26a00', '#1f7a45', '#2563b0', '#8e3b6e', '#6b645a'], ['#e48a66', '#e9a54a', '#6fcf97', '#7fb0ea', '#d68bb8', '#a89f92']).filter((c) => c !== accent.primary),
].slice(0, 6);
export const projectColor = (i: number) => projectColors[i % projectColors.length];
