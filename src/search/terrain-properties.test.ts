import { expect, it } from 'vitest';
import { braidedTerrain } from '../generate/terrain.js';
import { pathCost } from '../model/environment.js';
import type { SolverId } from '../model/wall-maze.js';
import { solve } from '../index.js';
import { checkPath } from './path-validity.js';

it.each(Array.from({ length: 50 }, (_, seed) => seed))('preserves terrain solver invariants for seed %i at all openness levels', seed => {
  for (const openness of [0, 0.5, 1]) {
    const environment = braidedTerrain({ seed, rows: 10, cols: 10, openness }).environment;
    const breadthFirst = solve(environment, 'bfs' as SolverId).result;
    const dijkstra = solve(environment, 'dijkstra' as SolverId).result;
    const astar = solve(environment, 'astar' as SolverId).result;
    expect(astar.cost).toBe(dijkstra.cost);
    expect(astar.exploredCount).toBeLessThanOrEqual(dijkstra.exploredCount);
    expect(breadthFirst.path.length).toBeLessThanOrEqual(dijkstra.path.length);
    expect(breadthFirst.path.length).toBeLessThanOrEqual(astar.path.length);
    for (const result of [breadthFirst, dijkstra, astar]) {
      expect(result.outcome).toBe('found');
      expect(checkPath(environment, result.path, environment).ok).toBe(true);
      expect(result.cost).toBe(pathCost(environment, result.path));
    }
    if (openness === 0) {
      expect(breadthFirst.path).toEqual(dijkstra.path);
      expect(breadthFirst.path).toEqual(astar.path);
    }
  }
});
