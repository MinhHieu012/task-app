import { ACCENTS, contrast } from '@core/accent';

import { palette, projectColors } from './palette';

describe('palette', () => {
  it('keeps the default accent and white text on it in the light theme', () => {
    const p = palette('#2563b0', false);
    expect(p['--color-accent']).toBe('#2563b0');
    expect(p['--color-accent-ink']).toBe('#ffffff');
  });

  it('gives every preset readable text, light and dark', () => {
    for (const { hex } of ACCENTS) {
      for (const dark of [false, true]) {
        const p = palette(hex, dark);
        expect(contrast(p['--color-accent'], p['--color-accent-ink'])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p['--color-muted'], p['--color-sheet'])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('never repeats the accent among project colours', () => {
    const c = projectColors('#b04a24', false);
    expect(new Set(c).size).toBe(c.length);
    expect(c[0]).toBe('#b04a24');
  });
});
