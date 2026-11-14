import { expect, it } from 'vitest';
import { terrainPips } from './draw-maze.js';

it.each([0, 1, 2, 3] as const)('keeps all %s terrain pips clear of the existing cell glyphs', band => {
  const pips = terrainPips(band);
  expect(pips).toHaveLength(band);
  for (const { center: { x, y }, radius } of pips) {
    // A circle outside either axis of the frontier rectangle cannot overlap it.
    expect(x + radius < 0.2 || x - radius > 0.8 || y + radius < 0.2 || y - radius > 0.8).toBe(true);
    // Both possible path directions through a cell have width 0.22.
    expect(Math.abs(x - 0.5) - radius).toBeGreaterThan(0.11);
    expect(Math.abs(y - 0.5) - radius).toBeGreaterThan(0.11);
    expect(Math.hypot(x - 0.5, y - 0.5) - radius).toBeGreaterThan(0.23);
    expect(x + radius < 0.27 || x - radius > 0.73 || y + radius < 0.27 || y - radius > 0.73).toBe(true);
    // Also clear the combined start/goal outline, failure cross and boundary walls.
    expect(Math.min(x, y, 1 - x, 1 - y) - radius).toBeGreaterThan(0.03);
    expect(x + radius < 0.15 || x - radius > 0.85 || y + radius < 0.15 || y - radius > 0.85).toBe(true);
  }
});
