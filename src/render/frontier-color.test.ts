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
