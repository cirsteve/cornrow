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
