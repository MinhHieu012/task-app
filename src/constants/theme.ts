// Hallmark redesign (2026-11-09): the Almanac material. Slate stock, a pale printed sheet for content,
// blue-black ink, hairline and firm rules, square corners, one deep magenta for the primary action and the
// current selection only. Values are the theme's OKLCH tokens converted to hex (native RN has no oklch()).
// Every text colour passes 4.5:1 on the sheet; priority 2 and 4 text sits a step darker than their marks.
// Be Vietnam Pro stays the one family: it has full Vietnamese glyphs (DM Sans broke them). Loaded in src/app/_layout.tsx.
export const font = 'Be Vietnam Pro';

export const color = {
  primary: '#970d63', // accent, oklch(45% .18 350)
  primaryHover: '#76004b',
  primaryFg: '#f2f6f9',
  primaryLight: '#f1d5e1', // selection wash
  ringFocus: '#9d0367', // focus ring, drawn as an outline

  background: '#c4cbd2', // slate stock
  surface: '#e5eaef', // the printed sheet
  rail: '#bbc2c8', // paper-2
  field: '#e5eaef',
  foreground: '#060e15', // ink
  soft: '#182027', // ink-2
  muted: '#3b434b',
  border: '#a1a9af', // hairline rule
  borderStrong: '#2b343b', // firm rule
  itemHover: '#d7dde3',
  secondary: '#bbc2c8',
  secondaryHover: '#aeb5bb',
  buttonHover: '#d7dde3',
  ghostHover: '#d7dde3',
  chip: '#d7dde3',
  chipHover: '#c4cbd2',
  chipText: '#182027',
  backdrop: 'rgba(6,14,21,0.45)',
  skeleton: '#c9cfd5',
  chartBar: '#6b737a',
  chartBarHover: '#3b434b',
  scrollbar: 'rgba(6,14,21,0.28)',

  danger: '#a51f1e',
  dangerBg: '#f8deda',
  dangerBgHover: '#f4cdc8',
  error: '#a51f1e',
  errorRing: '#a51f1e',
  errorText: '#a51f1e',
  errorBg: '#f8deda',
  errorStrong: '#8a1716',
  successBg: '#d7ebda',
  success: '#196632',
  warningBg: '#f4e1cc',
  warning: '#934f00',
  infoBg: '#d5e3f2',
  neutralBg: '#d7dde3',
  neutral: '#182027',
} as const;

// Priority scale: ticks, choice marks and the priority tag.
export const priority = { 1: '#b32322', 2: '#a45e00', 3: '#215da5', 4: '#6b737a' } as const;
export const priorityBg = { 1: '#f8deda', 2: '#f4e1cc', 3: '#d5e3f2', 4: '#d7dde3' } as const;
export const priorityText = { 1: '#a51f1e', 2: '#934f00', 3: '#215da5', 4: '#3b434b' } as const;
export type Priority = keyof typeof priority;

// Square corners: 2px on controls, 0 on surfaces. `full` stays for round ticks and the avatar.
export const radius = { sm: 2, ctl: 2, md: 2, lg: 0, full: 9999 } as const;
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 } as const;
// Two rule weights carry every surface: a hairline between rows, a firm line under a head.
export const rule = { hair: 1, bar: 2 } as const;

// Heads one weight (600), tightened; body at 16. Figures use tabular numerals (`num`).
export const text = {
  h1: { fontFamily: font, fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: -0.6 },
  h2: { fontFamily: font, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.2 },
  xl: { fontFamily: font, fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.3 },
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

// No drop shadows in this material: depth is a rule and a paper step.
export const shadowModal = 'none';
export const shadowPrimary = 'none';

// Project marks, picked by the project's position in the name-sorted list. Muted print inks, all >= 3:1 on the sheet.
export const projectColors = ['#970d63', '#a45e00', '#196632', '#215da5', '#a51f1e', '#3b434b'] as const;
export const projectColor = (i: number) => projectColors[i % projectColors.length];
