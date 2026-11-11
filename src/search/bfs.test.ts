import { describe, expect, it } from 'vitest';
import { recursiveBacktracker } from '../generate/recursive-backtracker';
import { comparisonMaze, isolatedGoalMaze, openCorridorMaze } from '../model/fixtures';
import { nodeIdOf, type WallMaze } from '../model/wall-maze';
import { bfs } from './bfs';
import { cancelledResult, type Endpoints, type SolveResult, type TraceEvent } from './contract';
import { checkPath } from './path-validity';

function drain(maze: WallMaze, endpoints: Endpoints = maze): { events: TraceEvent[]; result: SolveResult } {
  const iterator = bfs(maze, endpoints);
  const events: TraceEvent[] = [];
  let step = iterator.next();
  while (!step.done) {
    events.push(step.value);
    step = iterator.next();
  }
  return { events, result: step.value };
}

describe('BFS stepper', () => {
  it.each([openCorridorMaze, comparisonMaze, recursiveBacktracker({ seed: 'cornrow', rows: 10, cols: 10 }).environment])(
    'finds a valid path with exactly one terminal path event in $id', maze => {
      const { events, result } = drain(maze);
      expect(result.outcome).toBe('found');
      expect(checkPath(maze, result.path, maze).ok).toBe(true);
      expect(events.filter(event => event.type === 'path')).toEqual([{ type: 'path', path: result.path }]);
      expect(events.at(-1)).toEqual({ type: 'path', path: result.path });
      expect(result.exploredCount).toBe(events.filter(event => event.type === 'visit').length);
      expect(result.space).toBe('discrete-graph');
      const enqueued = new Set<number>();
      for (const event of events) {
        if (event.type === 'frontier-add') {
          expect(enqueued.has(event.node)).toBe(false);
          enqueued.add(event.node);
        }
        if (event.type === 'visit') expect(enqueued.has(event.node)).toBe(true);
      }
    },
  );

  it('returns unreachable with no path event for a hand-built isolated goal', () => {
    const { result, events } = drain(isolatedGoalMaze);
    expect(result).toMatchObject({ outcome: 'unreachable', path: [], space: 'discrete-graph' });
    expect(events.some(event => event.type === 'path')).toBe(false);
    expect(result.exploredCount).toBe(events.filter(event => event.type === 'visit').length);
  });

  it('accepts custom endpoints, including start equal to goal', () => {
    const endpoints = { start: nodeIdOf(comparisonMaze, { row: 3, col: 2 }), goal: nodeIdOf(comparisonMaze, { row: 1, col: 0 }) };
    expect(checkPath(comparisonMaze, drain(comparisonMaze, endpoints).result.path, endpoints).ok).toBe(true);
    const single = { start: comparisonMaze.start, goal: comparisonMaze.start };
    expect(drain(comparisonMaze, single).result).toEqual({ outcome: 'found', path: [single.start], exploredCount: 1, space: 'discrete-graph' });
  });

  it('steps and replays identically while preserving the frozen environment', () => {
    const maze = comparisonMaze;
    const before = JSON.stringify(maze);
    const full = drain(maze);
    const iterator = bfs(maze, maze);
    const stepped: TraceEvent[] = [];
    let step = iterator.next();
    while (!step.done) {
      stepped.push(step.value);
      expect(JSON.stringify(maze)).toBe(before);
      step = iterator.next();
    }
    expect({ events: stepped, result: step.value }).toEqual(full);
    expect(drain(maze)).toEqual(full);
    expect(JSON.stringify(maze)).toBe(before);
    expect(Object.isFrozen(maze)).toBe(true);
    expect(Object.isFrozen(maze.passages)).toBe(true);
  });

  it('stops when the consumer returns a cancelled result mid-solve', () => {
    const before = JSON.stringify(comparisonMaze);
    const iterator = bfs(comparisonMaze, comparisonMaze);
    expect(iterator.next().value).toEqual({ type: 'frontier-add', node: comparisonMaze.start });
    expect(iterator.next().value).toEqual({ type: 'visit', node: comparisonMaze.start });
    const cancelled = cancelledResult(1);
    expect(iterator.return(cancelled)).toEqual({ done: true, value: cancelled });
    expect(iterator.next().done).toBe(true);
    expect(JSON.stringify(comparisonMaze)).toBe(before);
    expect(() => { (comparisonMaze.passages as number[])[0] = 15; }).toThrow(TypeError);
  });

  it('rejects empty, endpoint-mismatched and wall-crossing paths', () => {
    expect(checkPath(openCorridorMaze, [], openCorridorMaze).ok).toBe(false);
    expect(checkPath(openCorridorMaze, [openCorridorMaze.start], openCorridorMaze).ok).toBe(false);
    expect(checkPath(openCorridorMaze, [openCorridorMaze.start, openCorridorMaze.goal], openCorridorMaze)).toMatchObject({ ok: false, error: { detail: 'Path crosses a wall' } });
  });
});
