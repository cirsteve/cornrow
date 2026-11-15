import { expect, it } from 'vitest';
import { frontierColor } from './frontier-color.js';
import { normaliseHex } from './merge-appearance.js';
it('preserves bases, grays, clamping and repeated independent transforms', () => {
  for (const value of ['#E69F00', '#684500', '#808080']) {
    const base = normaliseHex(value);
    if (!base.ok) throw new Error('fixture');
    expect(frontierColor(base.value, 1)).toBe(value);
    const gray = frontierColor(base.value, 0);
    expect(gray.slice(1, 3)).toBe(gray.slice(3, 5));
    expect(gray.slice(3, 5)).toBe(gray.slice(5, 7));
    for (let i = 0; i < 10; i++) expect(frontierColor(base.value, 0.4)).toBe(frontierColor(base.value, 0.4));
    expect(frontierColor(base.value, 2)).toBe(value);
  }
});

function hsl(hex: string): readonly [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const h = d === 0 ? 0 : ((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) + 6) % 6;
  return [h, d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l];
}
it('doubles partial saturation while preserving hue and lightness within channel rounding', () => {
  const base = normaliseHex('#B09070');
  if (!base.ok) throw new Error('fixture');
  const before = hsl(base.value), after = hsl(frontierColor(base.value, 2));
  expect(after[1]).toBeGreaterThan(before[1]);
  expect(after[1]).toBeCloseTo(Math.min(1, before[1] * 2), 2);
  expect(after[0]).toBeCloseTo(before[0], 2);
  expect(after[2]).toBeCloseTo(before[2], 2);
});
it('derives independent wall and terrain hues from their own bases', () => {
  const wall = normaliseHex('#E69F00'), terrain = normaliseHex('#684500');
  if (!wall.ok || !terrain.ok) throw new Error('fixture');
  const w = frontierColor(wall.value, 0.4), t = frontierColor(terrain.value, 0.4);
  expect(w).not.toBe(t);
  expect(hsl(w)[0]).toBeCloseTo(hsl(wall.value)[0], 1);
  expect(hsl(t)[0]).toBeCloseTo(hsl(terrain.value)[0], 1);
  expect(hsl(w)[2]).toBeCloseTo(hsl(wall.value)[2], 2);
  expect(hsl(t)[2]).toBeCloseTo(hsl(terrain.value)[2], 2);
});
