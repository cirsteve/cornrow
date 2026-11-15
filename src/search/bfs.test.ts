import { describe, expect, expectTypeOf, it } from 'vitest';
import { recursiveBacktracker } from '../generate/recursive-backtracker';
import { comparisonMaze, isolatedGoalMaze, openCorridorMaze } from '../model/fixtures';
import { nodeIdOf, type SolverId, type WallMaze } from '../model/wall-maze';
import { bfs } from './bfs';
import { cancelledResult, type Endpoints, type SolveResult, type TraceEvent } from './contract';
import { checkPath } from './path-validity';
import { generate, getSolver, solve, solverRegistry } from '../index';

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
    expect(drain(comparisonMaze, single).result).toEqual({ outcome: 'found', path: [single.start], exploredCount: 1, cost: 0, space: 'discrete-graph' });
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

describe('public DOM-free core', () => {
  it('generates a maze and drains both registered solvers with default endpoints', () => {
    const { environment } = generate({ seed: 'cornrow', rows: 10, cols: 10 });
    for (const { id } of solverRegistry) {
      const { result, events } = solve(environment, id);
      expect(result.outcome).toBe('found');
      expect(checkPath(environment, result.path, environment).ok).toBe(true);
      expect(events.at(-1)).toEqual({ type: 'path', path: result.path });
    }
    const descriptor = getSolver('bfs');
    if (!descriptor.ok) throw new Error(descriptor.error.detail);
    expect(solve(environment, descriptor.value.id)).toEqual(drain(environment));
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('drains custom endpoints and unreachable results through the public entry', () => {
    const endpoints = { start: comparisonMaze.goal, goal: comparisonMaze.start };
    const breadthFirst = getSolver('bfs');
    const aStar = getSolver('astar');
    if (!breadthFirst.ok) throw new Error(breadthFirst.error.detail);
    if (!aStar.ok) throw new Error(aStar.error.detail);
    const run = solve(comparisonMaze, breadthFirst.value.id, endpoints);
    expect(checkPath(comparisonMaze, run.result.path, endpoints).ok).toBe(true);
    expect(solve(isolatedGoalMaze, aStar.value.id).result.outcome).toBe('unreachable');
  });

  it('requires a branded solver id and validates user-selected strings through Result', () => {
    expectTypeOf<Parameters<typeof solve>[1]>().toEqualTypeOf<SolverId>();
    expectTypeOf<string>().not.toMatchTypeOf<Parameters<typeof solve>[1]>();
    const selected = getSolver('astar');
    if (!selected.ok) throw new Error(selected.error.detail);
    expect(solve(comparisonMaze, selected.value.id).result.outcome).toBe('found');
    expect(getSolver('unknown')).toMatchObject({
      ok: false,
      error: { operation: 'getSolver', id: 'unknown' },
    });
  });
});

// Shared continuation invariants apply to every frontier implementation.
import { bfsResumable } from './bfs';
import { dijkstra, dijkstraResumable } from './dijkstra';
import { astar, astarResumable } from './astar';
import type { ResumableSearch, ResumableSolver, ResumableStep, Solver } from './contract';
import type { Environment } from '../model/environment';
import { pathCost } from '../model/environment';
import { ridgeTerrain } from '../model/fixtures';
import { toNodeId } from '../model/wall-maze';
import { addObstacles, removeObstacles } from '../edit/edit-environment';
import { applyTraceEvent, initialTraceState } from '../trace/trace-state';

function drainSession(session: Pick<ResumableSearch, 'next'>) {
  const events: TraceEvent[] = [];
  for (let count = 0; count < 10000; count++) {
    const step = session.next();
    if (step.done) return { events, result: step.value };
    events.push(step.value);
  }
  throw new Error('Session did not finish');
}

function cut(environment: Environment, from: number, to: number): Environment {
  const passages = [...environment.passages];
  const forward = to === from + 1 ? 2 : 4;
  const backward = forward === 2 ? 8 : 1;
  passages[from] = (passages[from] ?? 0) & ~forward;
  passages[to] = (passages[to] ?? 0) & ~backward;
  return Object.freeze({ ...environment, passages: Object.freeze(passages) });
}

it('exposes the resumable contract types', () => {
  expectTypeOf(bfsResumable).toEqualTypeOf<ResumableSolver>();
  expectTypeOf<ReturnType<ResumableSearch['next']>>().toEqualTypeOf<ResumableStep>();
});

const sessions: readonly [string, ResumableSolver, Solver][] = [
  ['bfs', bfsResumable, bfs], ['dijkstra', dijkstraResumable, dijkstra], ['astar', astarResumable, astar],
];
describe.each(sessions)('%s resumable', (_name, factory, solver) => {
  it.each([openCorridorMaze, isolatedGoalMaze, comparisonMaze, ridgeTerrain,
    recursiveBacktracker({ seed: 'cornrow', rows: 10, cols: 10 }).environment])('matches one-shot traces on $id', environment => {
    expect(drainSession(factory(environment, environment))).toEqual(drainSession(solver(environment, environment)));
  });

  it('moves to an expanded goal immediately and preserves cumulative visits', () => {
    const session = factory(comparisonMaze, comparisonMaze);
    for (let i = 0; i < 4; i++) session.next();
    const edited = { ...comparisonMaze, goal: comparisonMaze.start };
    expect(session.applyEdit(edited)).toEqual({ events: [{ type: 'edit', environment: edited }, { type: 'path', path: [edited.start] }], hasMoreToSearch: false });
    const step = session.next();
    expect(step).toMatchObject({ done: true, value: { outcome: 'found', path: [edited.start], exploredCount: 1 } });
    expect(session.next()).toEqual(step);
  });

  it('moves to an unexplored goal while keeping the live frontier', () => {
    const session = factory(comparisonMaze, comparisonMaze);
    for (let i = 0; i < 4; i++) session.next();
    const edited = { ...comparisonMaze, goal: toNodeId(comparisonMaze, 20) };
    expect(session.applyEdit(edited).hasMoreToSearch).toBe(true);
    const { result } = drainSession(session);
    expect(result.outcome).toBe('found');
    expect(checkPath(edited, result.path, edited).ok).toBe(true);
  });

  it('invalidates an entire cut tree, replays it, and resumes after reopening', () => {
    const environment = openCorridorMaze;
    const session = factory(environment, environment);
    const first = drainSession(session);
    const edited = cut(environment, 1, 2);
    const change = session.applyEdit(edited);
    expect(change.events.map(event => event.type)).toEqual(['edit', 'invalidate']);
    expect(change.events[1]).toEqual({ type: 'invalidate', nodes: [2, 3, 4, 9, 14, 19, 24] });
    expect(change.hasMoreToSearch).toBe(false);
    const second = drainSession(session);
    expect(second.result.outcome).toBe('unreachable');
    const state = [...first.events, ...change.events, ...second.events].reduce(applyTraceEvent, initialTraceState);
    expect(state.environment).toBe(edited);
    for (const node of [2, 3, 4, 9, 14, 19, 24]) {
      expect(state.visited.has(toNodeId(edited, node))).toBe(false);
      expect(state.frontier.has(toNodeId(edited, node))).toBe(false);
    }
    const reopen = session.applyEdit(environment);
    expect(reopen.events).toEqual([{ type: 'edit', environment }, { type: 'frontier-add', node: 2 }]);
    expect(reopen.hasMoreToSearch).toBe(true);
    const resumed = drainSession(session);
    expect(resumed.result.outcome).toBe('found');
    expect(checkPath(environment, resumed.result.path, environment).ok).toBe(true);
    const replay = [...reopen.events, ...resumed.events].reduce(applyTraceEvent, state);
    expect(replay.path).toEqual(resumed.result.path);
    expect(resumed.result.exploredCount).toBe([...first.events, ...second.events, ...resumed.events].filter(event => event.type === 'visit').length);
  });

  it('cuts and reseeds a frontier without visiting stale entries', () => {
    const session = factory(comparisonMaze, comparisonMaze);
    for (let i = 0; i < 6; i++) session.next();
    const edited = cut(comparisonMaze, 0, 1);
    const change = session.applyEdit(edited);
    expect(change.events[0]).toEqual({ type: 'edit', environment: edited });
    expect(change.events.some(event => event.type === 'invalidate')).toBe(true);
    const { result, events } = drainSession(session);
    expect(result.outcome).toBe('found');
    expect(checkPath(edited, result.path, edited).ok).toBe(true);
    const visits = events.filter(event => event.type === 'visit').map(event => event.node);
    expect(new Set(visits).size).toBe(visits.length);
  });

  it('keeps a completed path across unrelated cuts', () => {
    const session = factory(openCorridorMaze, openCorridorMaze);
    const first = drainSession(session);
    const edited = cut(openCorridorMaze, 5, 6);
    expect(session.applyEdit(edited)).toEqual({ events: [{ type: 'edit', environment: edited }, { type: 'path', path: first.result.path }], hasMoreToSearch: false });
    expect(drainSession(session).result.path).toEqual(first.result.path);
  });

  it('rejects invalid edits before mutation', () => {
    const session = factory(comparisonMaze, comparisonMaze);
    const control = factory(comparisonMaze, comparisonMaze);
    session.next(); control.next();
    expect(() => session.applyEdit({ ...comparisonMaze, cols: 6 })).toThrow(RangeError);
    expect(() => session.applyEdit({ ...comparisonMaze, goal: -1 as typeof comparisonMaze.goal })).toThrow(RangeError);
    expect(drainSession(session)).toEqual(drainSession(control));
  });

  it('supports real obstacle cuts and reopenings', () => {
    const session = factory(comparisonMaze, comparisonMaze);
    for (let i = 0; i < 10; i++) session.next();
    const blocked = addObstacles(comparisonMaze, { row: 0, col: 1 }, 0);
    if (!blocked.ok) throw new Error(blocked.error.detail);
    session.applyEdit(blocked.value);
    const reopened = removeObstacles(blocked.value, { row: 0, col: 1 }, 0);
    if (!reopened.ok) throw new Error(reopened.error.detail);
    session.applyEdit(reopened.value);
    const { result } = drainSession(session);
    expect(checkPath(reopened.value, result.path, reopened.value).ok).toBe(true);
  });
});

it.each([dijkstraResumable, astarResumable])('rekeys terrain frontier costs without invalidation', factory => {
  const session = factory(ridgeTerrain, ridgeTerrain);
  for (let i = 0; i < 6; i++) session.next();
  const edited = addObstacles(ridgeTerrain, { row: 2, col: 1 }, 1);
  if (!edited.ok) throw new Error(edited.error.detail);
  const change = session.applyEdit(edited.value);
  expect(change.events[0]).toEqual({ type: 'edit', environment: edited.value });
  expect(change.events.slice(1).every(event => event.type === 'frontier-add')).toBe(true);
  const { result } = drainSession(session);
  expect(result.outcome).toBe('found');
  expect(result.cost).toBe(pathCost(edited.value, result.path));
  expect(checkPath(edited.value, result.path, edited.value).ok).toBe(true);
});

it('A* rekeys the existing frontier against the moved goal', () => {
  const session = astarResumable(comparisonMaze, comparisonMaze);
  // Frontier is east=1 (sequence 1), south=5 (sequence 2), both g=1.
  for (let i = 0; i < 4; i++) session.next();
  const edited = { ...comparisonMaze, goal: toNodeId(comparisonMaze, 20) };
  expect(session.applyEdit(edited).events).toEqual([{ type: 'edit', environment: edited }]);
  // South has h=3, f=4; east has h=5, f=6.
  expect(session.next()).toEqual({ done: false, value: { type: 'visit', node: 5 } });
  expect(checkPath(edited, drainSession(session).result.path, edited).ok).toBe(true);
});
