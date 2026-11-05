// Tokens from the Figma reference (Octom task app), chosen in the wireframe "A+B" (2026-11-05).
// Muted, red, green and amber are a step darker than the Figma file so text passes 4.5:1. Change the accent here only.
// Be Vietnam Pro: close to the Figma geometric sans and has full Vietnamese glyphs (DM Sans has none). Loaded in src/app/_layout.tsx.
export const font = 'Be Vietnam Pro';

export const color = {
  primary: '#5051f9',
  primaryHover: '#4243e0',
  primaryFg: '#ffffff',
  primaryLight: '#edecfe',
  ringFocus: 'rgba(80,81,249,0.14)',

  background: '#f3f4f8',
  surface: '#ffffff',
  rail: '#fbfaff',
  field: '#f3f6fa',
  foreground: '#232360',
  soft: '#4b5577',
  muted: '#5d6880',
  border: '#eceef3',
  borderStrong: '#e1e4ec',
  itemHover: '#f3f4f8',
  secondary: '#e7e8ec',
  secondaryHover: '#dbdce2',
  buttonHover: '#f3f4f8',
  ghostHover: 'rgba(35,35,96,0.05)',
  chip: 'rgba(35,35,96,0.05)',
  chipHover: 'rgba(35,35,96,0.10)',
  chipText: 'rgba(35,35,96,0.75)',
  backdrop: 'rgba(0,0,0,0.4)',
  skeleton: '#e9ebf1',
  chartBar: '#dcdbfe',
  chartBarHover: '#c9c8fd',

  danger: '#c8283a',
  dangerBg: '#ffecee',
  dangerBgHover: '#ffdfe3',
  error: '#c8283a',
  errorRing: 'rgba(200,40,58,0.12)',
  errorText: '#c8283a',
  errorBg: '#ffecee',
  errorStrong: '#a51d2d',
  successBg: '#e6f6ec',
  success: '#0e7a3e',
  warningBg: '#fff1e7',
  warning: '#c2410c',
  infoBg: '#e4f4ff',
  neutralBg: '#f3f4f8',
  neutral: '#4b5577',
} as const;

// Priority scale: ticks, choice dots and the priority tag.
export const priority = { 1: '#c8003a', 2: '#b45309', 3: '#155dfc', 4: '#8a93a6' } as const;
export const priorityBg = { 1: '#ffecee', 2: '#fff1e7', 3: '#e4f4ff', 4: '#f3f4f8' } as const;
export const priorityText = { 1: '#c8003a', 2: '#b45309', 3: '#155dfc', 4: '#5d6880' } as const;
export type Priority = keyof typeof priority;

export const radius = { sm: 8, ctl: 10, md: 12, lg: 16, full: 9999 } as const;
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 } as const;

export const text = {
  h1: { fontFamily: font, fontSize: 28, lineHeight: 36, fontWeight: '700' },
  h2: { fontFamily: font, fontSize: 18, lineHeight: 28, fontWeight: '600' },
  xl: { fontFamily: font, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  lg: { fontFamily: font, fontSize: 18, lineHeight: 28, fontWeight: '600' },
  base: { fontFamily: font, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  body: { fontFamily: font, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  sm: { fontFamily: font, fontSize: 14, lineHeight: 20 },
  smMedium: { fontFamily: font, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  meta: { fontFamily: font, fontSize: 13, lineHeight: 18 },
  xs: { fontFamily: font, fontSize: 12, lineHeight: 16 },
} as const;

export const shadowModal = '0 20px 25px -5px rgba(35,35,96,0.1), 0 8px 10px -6px rgba(35,35,96,0.1)';
export const shadowPrimary = '0 6px 16px rgba(80,81,249,0.28)';

// Project marks, picked by the project's position in the name-sorted list.
export const projectColors = ['#5051f9', '#e8590c', '#0e7a3e', '#1a96e6', '#c8283a', '#7c3aed'] as const;
export const projectColor = (i: number) => projectColors[i % projectColors.length];
