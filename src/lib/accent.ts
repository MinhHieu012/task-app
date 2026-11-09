// The accent the user picks in Settings, and the tokens derived from it (theme.ts). Pure, so it is checked in node.

export const DEFAULT_ACCENT = '#b04a24';

/** Suggested accents, all warm-leaning and readable with white text. `name` is a Vietnamese key for tr(). */
export const ACCENTS = [
  { hex: '#b04a24', name: 'Đất nung' },
  { hex: '#a8325a', name: 'Mận' },
  { hex: '#7b4fa0', name: 'Oải hương' },
  { hex: '#2563b0', name: 'Biển' },
  { hex: '#2f7a4f', name: 'Rừng' },
  { hex: '#8a5a12', name: 'Hổ phách' },
  { hex: '#4a4540', name: 'Than' },
] as const;

export const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s.trim());

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** Mix `hex` toward `to` (0 = hex, 1 = to). */
const mix = (hex: string, to: string, w: number) => {
  const a = rgb(hex), b = rgb(to);
  return toHex(a.map((v, i) => v + (b[i] - v) * w));
};

/** WCAG contrast ratio between two colours. */
export function contrast(x: string, y: string) {
  const lum = (hex: string) => {
    const [r, g, b] = rgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(x), lum(y)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** Tokens for an accent. A light pick is darkened until white text on it reads (4.5:1), so buttons stay legible. */
export function accentTokens(input: string) {
  let primary = isHex(input) ? input.trim().toLowerCase() : DEFAULT_ACCENT;
  while (contrast(primary, '#ffffff') < 4.5) primary = mix(primary, '#000000', 0.05);
  return {
    primary,
    hover: mix(primary, '#000000', 0.15),
    light: mix(primary, '#ffffff', 0.92), // selection wash
    bar: mix(primary, '#ffffff', 0.62), // chart bars: a tint, so the selected day stays strongest
    barHover: mix(primary, '#ffffff', 0.45),
  };
}
