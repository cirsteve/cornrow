import { expect, it } from 'vitest';
import { comparisonMaze, isolatedGoalMaze, openCorridorMaze, ridgeTerrain } from '../model/fixtures.js';
import { pathCost } from '../model/environment.js';
import { solve } from '../index.js';
import type { SolverId } from '../model/wall-maze.js';
import { dijkstra } from './dijkstra.js';
import { getSolver, solverRegistry } from './registry.js';
import { cancelledResult } from './contract.js';
import { checkPath } from './path-validity.js';

it.each([openCorridorMaze, comparisonMaze])('finds a BFS-length path on wall fixture $id', maze => {
  const result = solve(maze, 'dijkstra' as SolverId).result;
  expect(result.outcome).toBe('found');
  expect(result.path.length).toBe(solve(maze, 'bfs' as SolverId).result.path.length);
  expect(checkPath(maze, result.path, maze).ok).toBe(true);
  expect(result.cost).toBe(result.path.length - 1);
});

it('reports unreachable and cancelled costs as null for all solvers', () => {
  for (const { id, solver } of solverRegistry) {
    const run = solve(isolatedGoalMaze, id);
    expect(run.result).toMatchObject({ outcome: 'unreachable', cost: null, path: [] });
    expect(run.events.some(event => event.type === 'path')).toBe(false);
    const iterator = solver(comparisonMaze, comparisonMaze);
    iterator.next();
    expect(iterator.return(cancelledResult(0))).toEqual({ done: true, value: { outcome: 'cancelled', path: [], exploredCount: 0, cost: null, space: 'discrete-graph' } });
  }
});

it('pins the ridge paths under N/E/S/W discovery and distance/sequence ties', () => {
  // At distance 2, node 16 is discovered from 11 before 20 is expanded;
  // 21 therefore inherits 16, and north-first expansion from 23 reaches 18 then 13.
  // A* prefers lower h at equal f and reaches the same bottom gap and north return.
  const expected = {
    bfs: { path: [10, 11, 12, 13, 14], cost: 11 },
    dijkstra: { path: [10, 11, 16, 21, 22, 23, 18, 13, 14], cost: 8 },
    astar: { path: [10, 11, 16, 21, 22, 23, 18, 13, 14], cost: 8 },
  };
  for (const [id, pinned] of Object.entries(expected)) {
    const result = solve(ridgeTerrain, id as SolverId).result;
    expect(result).toMatchObject({ outcome: 'found', ...pinned });
    expect(checkPath(ridgeTerrain, result.path, ridgeTerrain).ok).toBe(true);
    expect(result.cost).toBe(pathCost(ridgeTerrain, result.path));
  }
  expect(solve(ridgeTerrain, 'bfs' as SolverId).result.cost).toBeGreaterThan(solve(ridgeTerrain, 'dijkstra' as SolverId).result.cost ?? 0);
  expect(solve(ridgeTerrain, 'dijkstra' as SolverId).result.cost).toBe(solve(ridgeTerrain, 'astar' as SolverId).result.cost);
});

it('registers Dijkstra between BFS and A*', () => {
  expect(solverRegistry.map(descriptor => descriptor.id)).toEqual(['bfs', 'dijkstra', 'astar']);
  expect(getSolver('dijkstra')).toMatchObject({ ok: true, value: { label: 'Dijkstra', solver: dijkstra } });
});

it('uses coherent events, supports a single-node path and rejects invalid endpoints', () => {
  const run = solve(ridgeTerrain, 'dijkstra' as SolverId);
  expect(run.events.at(-1)).toEqual({ type: 'path', path: run.result.path });
  const visited = run.events.filter(event => event.type === 'visit');
  expect(visited).toHaveLength(run.result.exploredCount);
  expect(new Set(visited.map(event => event.node)).size).toBe(visited.length);
  expect(solve(ridgeTerrain, 'dijkstra' as SolverId, { start: ridgeTerrain.start, goal: ridgeTerrain.start }).result)
    .toMatchObject({ outcome: 'found', path: [10], cost: 0, exploredCount: 1 });
  expect(() => solve(ridgeTerrain, 'missing' as SolverId)).toThrow(RangeError);
});
