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

const hsl = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
};
const fromHsl = (h: number, s: number, l: number) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([r, g, b].map((v) => (v + m) * 255));
};

/** The warm neutrals (cream paper, rules, inks) were tuned for terracotta; under another accent they read yellow.
 *  Turn their hue by the accent's distance from the default, keeping saturation and lightness, so the default
 *  theme is unchanged and every other accent gets neutrals of its own family. */
export function neutral(hex: string, accent: string) {
  const turn = hsl(accent)[0] - hsl(DEFAULT_ACCENT)[0];
  if (!turn) return hex;
  const [h, s, l] = hsl(hex);
  return fromHsl((h + turn + 360) % 360, s, l);
}

/** The dark theme's sheet; the accent is lightened against it. */
export const DARK_SURFACE = '#24211e';

/** Tokens for an accent. A light pick is darkened until white text on it reads (4.5:1), so buttons stay legible.
 *  Dark theme: the accent is lightened until it reads as text on the dark sheet, and carries dark text instead. */
export function accentTokens(input: string, dark = false) {
  let primary = isHex(input) ? input.trim().toLowerCase() : DEFAULT_ACCENT;
  if (dark) {
    while (contrast(primary, DARK_SURFACE) < 4.5) primary = mix(primary, '#ffffff', 0.05);
    return {
      primary,
      hover: mix(primary, '#ffffff', 0.15),
      light: mix(primary, DARK_SURFACE, 0.82),
      bar: mix(primary, DARK_SURFACE, 0.55),
      barHover: mix(primary, DARK_SURFACE, 0.35),
    };
  }
  while (contrast(primary, '#ffffff') < 4.5) primary = mix(primary, '#000000', 0.05);
  return {
    primary,
    hover: mix(primary, '#000000', 0.15),
    light: mix(primary, '#ffffff', 0.92), // selection wash
    bar: mix(primary, '#ffffff', 0.62), // chart bars: a tint, so the selected day stays strongest
    barHover: mix(primary, '#ffffff', 0.45),
  };
}
