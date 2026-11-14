import { expect, it } from 'vitest';
import { pathCost, stepCost } from './environment.js';
import { openCorridorMaze, ridgeTerrain } from './fixtures.js';
import { toNodeId } from './wall-maze.js';

it('uses unit entry costs for wall mazes', () => {
  const path = [0, 1, 2, 3, 4].map(node => toNodeId(openCorridorMaze, node));
  expect(stepCost(openCorridorMaze, path[0] ?? openCorridorMaze.start)).toBe(1);
  expect(pathCost(openCorridorMaze, path)).toBe(path.length - 1);
});

it('sums terrain entry costs excluding the start', () => {
  const path = [10, 11, 12, 13, 14].map(node => toNodeId(ridgeTerrain, node));
  expect(stepCost(ridgeTerrain, toNodeId(ridgeTerrain, 12))).toBe(8);
  expect(pathCost(ridgeTerrain, path)).toBe(11);
  expect(pathCost(ridgeTerrain, [toNodeId(ridgeTerrain, 12)])).toBe(0);
});
