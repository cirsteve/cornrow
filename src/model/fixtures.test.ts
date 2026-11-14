import { expect, it } from 'vitest';
import { ridgeTerrain } from './fixtures.js';
import { neighbours, openNeighbours, toNodeId } from './wall-maze.js';

it('provides a fully open ridge with a low-cost gap on the bottom row', () => {
  expect(ridgeTerrain).toMatchObject({ kind: 'terrain', rows: 5, cols: 5, start: 10, goal: 14 });
  expect(ridgeTerrain.costs).toEqual([
    1, 1, 8, 1, 1,
    1, 1, 8, 1, 1,
    1, 1, 8, 1, 1,
    1, 1, 8, 1, 1,
    1, 1, 1, 1, 1,
  ]);
  for (let index = 0; index < 25; index += 1) {
    const node = toNodeId(ridgeTerrain, index);
    expect(openNeighbours(ridgeTerrain, node)).toEqual(neighbours(ridgeTerrain, node));
  }
});
