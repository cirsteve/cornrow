import { describe, expect, it } from 'vitest';
import { recursiveBacktracker } from '../generate/recursive-backtracker';
import { comparisonMaze, isolatedGoalMaze, openCorridorMaze, ridgeTerrain } from '../model/fixtures';
import type { Environment } from '../model/environment.js';
import { nodeIdOf } from '../model/wall-maze';
import { astar } from './astar';
import { bfs } from './bfs';
import { cancelledResult, type Endpoints, type SolveResult, type Solver, type TraceEvent } from './contract';
import { checkPath } from './path-validity';
import { getSolver, solverRegistry } from './registry';

function drain(solver: Solver, maze: Environment, endpoints: Endpoints = maze): { events: TraceEvent[]; result: SolveResult } {
  const iterator = solver(maze, endpoints);
  const events: TraceEvent[] = [];
  let step = iterator.next();
  while (!step.done) {
    events.push(step.value);
    step = iterator.next();
  }
  return { events, result: step.value };
}

describe('A* Manhattan stepper and registry', () => {
  it.each([
    openCorridorMaze, comparisonMaze,
    ...['cornrow', 'other', 'third'].map(seed => recursiveBacktracker({ seed, rows: 10, cols: 10 }).environment),
  ])('finds a valid shortest path with coherent trace events in $id', maze => {
    const { result, events } = drain(astar, maze);
    expect(result.outcome).toBe('found');
    expect(checkPath(maze, result.path, maze).ok).toBe(true);
    expect(result.path.length).toBe(drain(bfs, maze).result.path.length);
    expect(events.filter(event => event.type === 'path')).toEqual([{ type: 'path', path: result.path }]);
    expect(events.at(-1)).toEqual({ type: 'path', path: result.path });
    const visits = events.filter(event => event.type === 'visit');
    expect(result.exploredCount).toBe(visits.length);
    expect(new Set(visits.map(event => event.node)).size).toBe(visits.length);
    const enqueued = new Set<number>();
    for (const event of events) {
      if (event.type === 'frontier-add') enqueued.add(event.node);
      if (event.type === 'visit') expect(enqueued.has(event.node)).toBe(true);
    }
  });

  it('returns unreachable with no path event for the isolated-goal fixture', () => {
    const { result, events } = drain(astar, isolatedGoalMaze);
    expect(result).toMatchObject({ outcome: 'unreachable', path: [], space: 'discrete-graph' });
    expect(events.some(event => event.type === 'path')).toBe(false);
  });

  it('breaks ties by lower Manhattan distance then insertion sequence', () => {
    const astarRun = drain(astar, comparisonMaze);
    const bfsRun = drain(bfs, comparisonMaze);
    const visits = (events: TraceEvent[]) => events.filter(event => event.type === 'visit').map(event => event.node);
    expect(visits(astarRun.events)).toEqual([0, 1, 2, 3, 4, 9, 14, 19, 24]);
    expect(visits(astarRun.events)).not.toEqual(visits(bfsRun.events));
    expect(astarRun.result.exploredCount).toBeLessThan(bfsRun.result.exploredCount);
  });

  it('supports custom endpoints and a one-cell path', () => {
    const endpoints = { start: nodeIdOf(comparisonMaze, { row: 4, col: 1 }), goal: nodeIdOf(comparisonMaze, { row: 0, col: 3 }) };
    expect(checkPath(comparisonMaze, drain(astar, comparisonMaze, endpoints).result.path, endpoints).ok).toBe(true);
    const single = { start: comparisonMaze.goal, goal: comparisonMaze.goal };
    expect(drain(astar, comparisonMaze, single).result).toMatchObject({ outcome: 'found', path: [single.start], exploredCount: 1 });
  });

  it('replays exactly, cancels on return, and preserves the environment', () => {
    const before = JSON.stringify(comparisonMaze);
    expect(drain(astar, comparisonMaze)).toEqual(drain(astar, comparisonMaze));
    const iterator = astar(comparisonMaze, comparisonMaze);
    iterator.next();
    iterator.next();
    expect(iterator.return(cancelledResult(1))).toEqual({ done: true, value: cancelledResult(1) });
    expect(iterator.next().done).toBe(true);
    expect(JSON.stringify(comparisonMaze)).toBe(before);
  });

  it('registers both algorithms and returns a contextual lookup error', () => {
    expect(solverRegistry.map(({ id, label }) => [id, label])).toEqual([
      ['bfs', 'Breadth-first search'], ['dijkstra', 'Dijkstra'], ['astar', 'A* (Manhattan)'],
    ]);
    expect(getSolver('astar')).toMatchObject({ ok: true, value: { solver: astar } });
    expect(getSolver('missing')).toEqual({ ok: false, error: { operation: 'getSolver', id: 'missing', detail: 'Unknown solver: missing' } });
    expect(Object.isFrozen(solverRegistry)).toBe(true);
  });
});

it('takes the eight-step low-cost route through the ridge gap', () => {
  const { result } = drain(astar, ridgeTerrain);
  expect(result).toMatchObject({ outcome: 'found', path: [10, 11, 16, 21, 22, 23, 18, 13, 14], cost: 8 });
  expect(result.path).toHaveLength(9);
  expect(result.path).toContain(22);
});
