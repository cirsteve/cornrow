import { expect, it } from 'vitest';
import { computeLayout } from './layout';

it.each([
  [5, 10, 500, 400, 50, 0, 75],
  [10, 5, 400, 500, 50, 75, 0],
  [5, 5, 100, 100, 20, 0, 0],
  [5, 5, 0, 100, 0, 0, 50],
])('centres square cells for a %i by %i grid in %i by %i', (rows, cols, width, height, cellSize, x, y) => {
  expect(computeLayout(rows, cols, { width, height })).toEqual({ cellSize, origin: { x, y } });
});

it('rejects invalid grid and surface dimensions', () => {
  expect(() => computeLayout(0, 5, { width: 100, height: 100 })).toThrow(RangeError);
  expect(() => computeLayout(5, 5, { width: NaN, height: 100 })).toThrow(RangeError);
});

import { cellAtPoint } from './layout.js';
it.each([[10, 20], [20, 10]])('inverts layout for %s by %s including letterboxes and resize', (rows, cols) => {
  const grid = { rows, cols };
  for (const size of [{ width: 400, height: 400 }, { width: 800, height: 300 }]) {
    const layout = computeLayout(rows, cols, size);
    const { origin, cellSize } = layout;
    expect(cellAtPoint(layout, grid, { x: origin.x + 3.5 * cellSize, y: origin.y + 2.5 * cellSize })).toEqual({ row: 2, col: 3 });
    expect(cellAtPoint(layout, grid, { x: origin.x + 3 * cellSize, y: origin.y + 2 * cellSize })).toEqual({ row: 2, col: 3 });
    for (const point of [{ x: origin.x - 1, y: origin.y }, { x: origin.x, y: origin.y - 1 }, { x: origin.x + cols * cellSize, y: origin.y }, { x: origin.x, y: origin.y + rows * cellSize }]) expect(cellAtPoint(layout, grid, point)).toBeNull();
  }
});
it('rejects hidden layouts and non-finite points', () => {
  const grid = { rows: 10, cols: 10 };
  expect(cellAtPoint(computeLayout(10, 10, { width: 0, height: 0 }), grid, { x: 0, y: 0 })).toBeNull();
  for (const n of [NaN, Infinity, -Infinity]) {
    const layout = computeLayout(10, 10, { width: 100, height: 100 });
    expect(cellAtPoint(layout, grid, { x: n, y: 0 })).toBeNull();
    expect(cellAtPoint(layout, grid, { x: 0, y: n })).toBeNull();
  }
});
