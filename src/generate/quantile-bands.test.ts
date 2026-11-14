import { expect, it } from 'vitest';
import { TERRAIN_COSTS } from '../model/terrain-maze.js';
import { quantileBands } from './quantile-bands.js';

it.each([[25, [10, 7, 5, 3]], [100, [40, 30, 20, 10]]] as const)('assigns exact quantile counts for %i nodes', (length, expected) => {
  const costs = quantileBands(Float64Array.from({ length }, (_, index) => length - index));
  expect(TERRAIN_COSTS.map(cost => costs.filter(value => value === cost).length)).toEqual(expected);
});

it('breaks equal-noise ties by ascending node id', () => {
  expect(quantileBands(new Float64Array(25).fill(0.5))).toEqual([
    ...Array<number>(10).fill(1), ...Array<number>(7).fill(2), ...Array<number>(5).fill(4), ...Array<number>(3).fill(8),
  ]);
});

it.each([25, 30, 64, 100, 400, 1600, 6400])('keeps all bands nonempty for %i nodes', length => {
  expect(new Set(quantileBands(new Float64Array(length)))).toEqual(new Set(TERRAIN_COSTS));
});
