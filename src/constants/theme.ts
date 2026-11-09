// Hallmark redesign (2026-11-09), softened the same day: Almanac's structure (ruled sheets, tables, tabular
// figures) in a warmer material. Cream stock, white sheets, warm ink, soft rounded corners, light rules, one
// terracotta accent for the primary action and the current selection only. The slate/ink/square version read cold.
// Every text colour passes 4.5:1 on the sheet; priority 2 and 4 text sits a step darker than their marks.
// Be Vietnam Pro stays the one family: it has full Vietnamese glyphs (DM Sans broke them). Loaded in src/app/_layout.tsx.
import { accentTokens, DEFAULT_ACCENT } from '@/lib/accent';
import { getPref } from '@/lib/prefs';

export const font = 'Be Vietnam Pro';

// The accent is the user's pick from Settings (default terracotta), read before any StyleSheet is built.
const accent = accentTokens(getPref('accent') ?? DEFAULT_ACCENT);

export const color = {
  primary: accent.primary,
  primaryHover: accent.hover,
  primaryFg: '#ffffff',
  primaryLight: accent.light, // selection wash
  ringFocus: accent.primary, // focus ring, drawn as an outline

  background: '#f6f3ee', // cream stock
  surface: '#ffffff', // the sheet
  rail: '#efeae2',
  field: '#ffffff',
  foreground: '#23211d', // warm ink
  soft: '#3f3b35',
  muted: '#6b645a',
  border: '#ebe5db', // hairline rule
  borderStrong: '#ddd5c8', // the rule under a head
  fieldEdge: '#948b7e', // input edge, 3:1 on the sheet
  itemHover: '#f6f1ea',
  secondary: '#efeae2',
  secondaryHover: '#e6dfd4',
  buttonHover: '#f6f1ea',
  ghostHover: '#f3eee6',
  chip: '#f3eee6',
  chipHover: '#ebe5db',
  chipText: '#3f3b35',
  backdrop: 'rgba(35,33,29,0.4)',
  skeleton: '#efeae2',
  chartBar: accent.bar, // a tint of the accent, so data reads while the selected day stays the strongest
  chartBarHover: accent.barHover,
  scrollbar: 'rgba(35,33,29,0.22)',

  danger: '#b42318',
  dangerBg: '#fdecea',
  dangerBgHover: '#fadcd8',
  error: '#b42318',
  errorRing: '#b42318',
  errorText: '#b42318',
  errorBg: '#fdecea',
  errorStrong: '#912018',
  successBg: '#e5f4ea',
  success: '#1f7a45',
  warningBg: '#fdf1dc',
  warning: '#9a5b00',
  infoBg: '#e6eef9',
  neutralBg: '#f3eee6',
  neutral: '#3f3b35',
} as const;

// Priority scale: ticks, choice marks and the priority tag.
export const priority = { 1: '#b42318', 2: '#b26a00', 3: '#2563b0', 4: '#8a8378' } as const;
export const priorityBg = { 1: '#fdecea', 2: '#fdf1dc', 3: '#e6eef9', 4: '#f3eee6' } as const;
export const priorityText = { 1: '#b42318', 2: '#9a5b00', 3: '#2563b0', 4: '#6b645a' } as const;
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
export const shadowModal = '0 12px 32px rgba(35,33,29,0.12)';
export const shadowPrimary = 'none';

// Project marks, picked by the project's position in the name-sorted list. All >= 3:1 on the sheet.
export const projectColors = ['#b04a24', '#b26a00', '#1f7a45', '#2563b0', '#8e3b6e', '#6b645a'] as const;
export const projectColor = (i: number) => projectColors[i % projectColors.length];
