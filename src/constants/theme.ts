// Tokens from docs/design/design-system.html (approved 2026-11-04, accent Đen). Change the accent here only.
export const color = {
  primary: '#181818',
  primaryHover: '#2e2e2e',
  primaryFg: '#ffffff',
  ringFocus: 'rgba(24,24,24,0.1)',

  background: '#f4f4f6',
  surface: '#ffffff',
  foreground: '#2c2c2c',
  muted: '#707070',
  border: '#f7f7f8',
  borderStrong: '#eaeaea',
  itemHover: '#f4f4f6',
  secondary: '#e7e8ec',
  secondaryHover: '#dbdce2',
  buttonHover: '#f1f1f3',
  ghostHover: 'rgba(44,44,44,0.05)',
  chip: 'rgba(44,44,44,0.05)',
  chipHover: 'rgba(44,44,44,0.10)',
  chipText: 'rgba(44,44,44,0.70)',
  backdrop: 'rgba(0,0,0,0.4)',

  danger: '#c70036',
  dangerBg: 'rgba(255,32,86,0.1)',
  dangerBgHover: 'rgba(255,32,86,0.15)',
  error: '#fb2c36',
  errorRing: 'rgba(251,44,54,0.1)',
  errorText: '#e7000b',
  errorBg: '#fef2f2',
  errorStrong: '#c10007',
  successBg: '#ecfdf5',
  success: '#007a55',
  warningBg: '#fffbeb',
  warning: '#bb4d00',
  neutralBg: '#f4f4f5',
  neutral: '#52525c',
} as const;

// Priority scale: only for ticks and choice dots.
export const priority = { 1: '#ec003f', 2: '#e17100', 3: '#155dfc', 4: '#707070' } as const;
export type Priority = keyof typeof priority;

export const radius = { sm: 8, md: 12, lg: 16, full: 9999 } as const;
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 } as const;

export const text = {
  xl: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  lg: { fontSize: 18, lineHeight: 28, fontWeight: '600' },
  base: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  sm: { fontSize: 14, lineHeight: 20 },
  smMedium: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  xs: { fontSize: 12, lineHeight: 16 },
} as const;

export const shadowModal = '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)';
