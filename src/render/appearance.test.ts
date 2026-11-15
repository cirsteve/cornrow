import { expect, it } from 'vitest';
import { defaultRenderAppearance as appearance, formatOverlay } from './appearance.js';
import { palette } from './palette.js';
it('preserves every legacy default and freezes every nested object', () => {
  for (const key of ['visitedOverlay', 'failureVisitedOverlay', 'cancelledOverlay'] as const)
    expect(formatOverlay(appearance.palette[key])).toBe(palette[key]);
  for (const key of Object.keys(palette) as (keyof typeof palette)[]) {
    if (!key.endsWith('Overlay')) expect(appearance.palette[key]).toEqual(palette[key]);
  }
  expect(appearance.palette.terrainPip).toBe('#222222');
  expect(appearance.frontier).toEqual({ shape: 'square', saturationScale: 1 });
  function frozen(value: unknown): void {
    if (value && typeof value === 'object') {
      expect(Object.isFrozen(value)).toBe(true);
      Object.values(value).forEach(frozen);
    }
  }
  frozen(appearance);
});

import type { RenderPalette } from './appearance.js';
import { normaliseHex } from './merge-appearance.js';
it('accepts a RenderPalette with a validated non-default color', () => {
  const walls = normaliseHex('#123456');
  if (!walls.ok) throw new Error('fixture');
  const custom: RenderPalette = { ...appearance.palette, walls: walls.value };
  expect(custom.walls).toBe('#123456');
});
