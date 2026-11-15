import type { MazeViewModel } from '../render/view-model.js';
import { selectViewModel } from '../render/select-view-model.js';
import { openNeighbours } from '../model/wall-maze.js';
import { describe, expect, it, vi } from 'vitest';
import { recursiveBacktracker } from '../generate/recursive-backtracker';
import type { WallMazeGenerator } from '../generate/contract';
import { comparisonMaze, isolatedGoalMaze } from '../model/fixtures';
import type { SolverId } from '../model/wall-maze';
import { astar } from '../search/astar';
import { bfs, bfsResumable } from '../search/bfs';
import { type Solver } from '../search/contract';
import { initialTraceState } from '../trace/trace-state';
import { createController, type ControllerEvent } from './controller';
import { createAnimationFrameScheduler, type FrameHandle, type FrameScheduler } from './frame-scheduler';
import { generateEnvironment } from '../generate/environment.js';
import { pathCost } from '../model/environment.js';
import { solverRegistry } from '../search/registry.js';
import { addObstacles, removeObstacles, setGoal } from '../edit/edit-environment.js';

class FakeScheduler implements FrameScheduler {
  private nextHandle = 0;
  readonly callbacks = new Map<FrameHandle, (nowMs: number) => void>();
  readonly cancelled: FrameHandle[] = [];
  request(callback: (nowMs: number) => void): FrameHandle {
    const handle = ++this.nextHandle;
    this.callbacks.set(handle, callback);
    return handle;
  }
  cancel(handle: FrameHandle): void { this.callbacks.delete(handle); this.cancelled.push(handle); }
  frame(nowMs: number): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(nowMs);
    expect(this.callbacks.size).toBeLessThanOrEqual(1);
  }
}

const solverId = 'injected' as SolverId;
const initialOptions = { seed: 'cornrow', rows: 5, cols: 5 };
function setup(solver: Solver = bfs, generator: WallMazeGenerator = recursiveBacktracker) {
  const scheduler = new FakeScheduler();
  const onRender = vi.fn();
  const injectedSolver = vi.fn(solver === bfs ? bfsResumable : (environment, endpoints) => {
    const iterator = solver(environment, endpoints);
    return { next: () => iterator.next(), applyEdit: () => { throw new Error('Test solver does not support edits'); } };
  });
  const injectedGenerator = vi.fn(generator);
  const controller = createController({
    generator: injectedGenerator, solvers: [{ id: solverId, label: 'Injected solver', solver, resumable: injectedSolver }],
    scheduler, onRender, initialOptions,
  });
  const events: ControllerEvent[] = [];
  controller.on(event => events.push(event));
  return { controller, scheduler, onRender, events, injectedSolver, injectedGenerator };
}

describe('controller playback', () => {
  it('generates and renders synchronously in idle without scheduling frames', () => {
    const { controller, scheduler, onRender } = setup();
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ traceState: initialTraceState, playback: { kind: 'idle' }, selectedSolver: solverId });
    expect(scheduler.callbacks.size).toBe(0);
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('solves, pauses, resumes and finishes with one render per frame and one pending frame at most', () => {
    const { controller, scheduler, onRender, events } = setup();
    controller.solve();
    expect(controller.getSnapshot().playback).toEqual({ kind: 'running', solverLabel: 'Injected solver' });
    expect(scheduler.callbacks.size).toBe(1);
    scheduler.frame(100);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(0);
    const rendered = onRender.mock.calls.length;
    scheduler.frame(200);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(6);
    expect(onRender).toHaveBeenCalledTimes(rendered + 1);
    controller.pause();
    expect(controller.getSnapshot().playback.kind).toBe('paused');
    expect(scheduler.callbacks.size).toBe(0);
    controller.pause();
    controller.resume(); controller.resume();
    const beforeResume = controller.getSnapshot().traceState.stepIndex;
    scheduler.frame(50_000);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(beforeResume);
    for (let now = 50_250; controller.getSnapshot().playback.kind === 'running'; now += 250) scheduler.frame(now);
    expect(controller.getSnapshot().playback).toMatchObject({ kind: 'finished', outcome: 'found', pathLength: expect.any(Number), exploredCount: expect.any(Number) });
    expect(scheduler.callbacks.size).toBe(0);
    expect(events.some(event => event.type === 'solved' && event.result.outcome === 'found')).toBe(true);
    expect(events.filter(event => event.type === 'solve-started')).toHaveLength(1);
  });

  it('changes speed on the next frame, clamps delayed frames and rejects invalid speeds without changing speed', () => {
    const { controller, scheduler } = setup();
    controller.solve(); scheduler.frame(0);
    controller.setSpeed(20); scheduler.frame(50);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(1);
    scheduler.frame(100_000);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(6);
    for (const speed of [0, -1, Infinity, NaN]) expect(() => controller.setSpeed(speed)).toThrow(RangeError);
    expect(controller.getSnapshot().stepsPerSecond).toBe(20);
  });

  it('enforces the 500 step per-frame cap with an injected long-running solver', () => {
    const solver: Solver = function* (maze) {
      for (let i = 0; i < 1200; i += 1) yield { type: 'visit', node: maze.start };
      return { outcome: 'unreachable', path: [], exploredCount: 1, cost: null, space: 'discrete-graph' };
    };
    const { controller, scheduler, onRender } = setup(solver);
    controller.setSpeed(10000); controller.solve(); scheduler.frame(0);
    const rendered = onRender.mock.calls.length;
    scheduler.frame(1000);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(500);
    expect(onRender).toHaveBeenCalledTimes(rendered + 1);
    scheduler.frame(1000);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(500);
    controller.runToEnd();
    expect(controller.getSnapshot().playback).toMatchObject({ kind: 'finished', outcome: 'unreachable' });
  });

  it.each(['running', 'paused'] as const)('cancels a %s solver session when generating and merges options', state => {
    const returned = vi.fn();
    const solver: Solver = (maze, endpoints) => {
      const iterator = bfs(maze, endpoints);
      const originalReturn = iterator.return.bind(iterator);
      iterator.return = value => { returned(value); return originalReturn(value); };
      return iterator;
    };
    const { controller, scheduler, events, injectedGenerator } = setup(solver);
    controller.solve(); scheduler.frame(0); scheduler.frame(100);
    if (state === 'paused') controller.pause();
    const exploredCount = controller.getSnapshot().traceState.visited.size;
    const staleFrame = [...scheduler.callbacks.values()][0];
    controller.generate({ seed: 'new' });
    expect(returned).not.toHaveBeenCalled();
    expect(events).toContainEqual({ type: 'state-change', playback: { kind: 'finished', outcome: 'cancelled', pathLength: 0, pathCost: null, exploredCount } });
    expect(injectedGenerator).toHaveBeenLastCalledWith({ ...initialOptions, seed: 'new' });
    expect(events.at(-1)?.type).toBe('generated');
    expect(controller.getSnapshot()).toMatchObject({ playback: { kind: 'idle' }, traceState: initialTraceState });
    staleFrame?.(1000);
    expect(scheduler.callbacks.size).toBe(0);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(0);
  });

  it.each(['running', 'paused'] as const)('resets a %s solve to idle without regenerating or reporting cancellation', state => {
    const returned = vi.fn();
    const solver: Solver = function* (maze) {
      try { yield { type: 'visit', node: maze.start }; yield { type: 'visit', node: maze.goal }; }
      finally { returned(); }
      return { outcome: 'unreachable', path: [], exploredCount: 2, cost: null, space: 'discrete-graph' };
    };
    const { controller, events, scheduler, injectedGenerator } = setup(solver);
    const environment = controller.getSnapshot().generation.environment;
    controller.step();
    if (state === 'running') controller.resume();
    controller.reset();
    expect(returned).not.toHaveBeenCalled();
    expect(controller.getSnapshot().generation.environment).toBe(environment);
    expect(injectedGenerator).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ traceState: initialTraceState, playback: { kind: 'idle' } });
    expect(events.some(event => event.type === 'state-change' && event.playback.kind === 'finished')).toBe(false);
    expect(scheduler.callbacks.size).toBe(0);
  });

  it('single-steps exactly one event from idle and paused, and ignores steps while running or finished', () => {
    const { controller, scheduler } = setup();
    controller.step();
    expect(controller.getSnapshot()).toMatchObject({ traceState: { stepIndex: 1 }, playback: { kind: 'paused' } });
    controller.step();
    expect(controller.getSnapshot().traceState.stepIndex).toBe(2);
    expect(scheduler.callbacks.size).toBe(0);
    controller.resume(); controller.step();
    expect(controller.getSnapshot().traceState.stepIndex).toBe(2);
    controller.pause();
    let steps = 2;
    while (controller.getSnapshot().playback.kind === 'paused') {
      controller.step();
      const next = controller.getSnapshot().traceState.stepIndex;
      expect(next - steps).toBeLessThanOrEqual(1);
      steps = next;
    }
    const final = controller.getSnapshot();
    controller.step(); controller.resume(); controller.pause();
    expect(controller.getSnapshot()).toEqual(final);
    expect(scheduler.callbacks.size).toBe(0);
  });

  it.each(['idle', 'running', 'paused'] as const)('drains synchronously from %s without leaving a frame', state => {
    const { controller, scheduler, onRender } = setup();
    if (state === 'running') controller.solve();
    if (state === 'paused') controller.step();
    const rendered = onRender.mock.calls.length;
    controller.runToEnd();
    expect(controller.getSnapshot().playback).toMatchObject({ kind: 'finished', outcome: 'found' });
    expect(onRender).toHaveBeenCalledTimes(rendered + 1);
    expect(scheduler.callbacks.size).toBe(0);
  });

  it.each([comparisonMaze, isolatedGoalMaze])('replays $id repeatedly without calling its solver or mutating its environment', maze => {
    const generator: WallMazeGenerator = options => ({ ...recursiveBacktracker(options), environment: maze });
    const { controller, scheduler, injectedSolver } = setup(bfs, generator);
    const environment = controller.getSnapshot().generation.environment;
    const before = JSON.stringify(environment);
    controller.runToEnd();
    const final = controller.getSnapshot();
    for (let repeat = 0; repeat < 2; repeat += 1) {
      controller.replay();
      expect(controller.getSnapshot().traceState).toEqual(initialTraceState);
      expect(scheduler.callbacks.size).toBe(1);
      scheduler.frame(1000);
      expect(controller.getSnapshot().traceState.stepIndex).toBe(0);
      scheduler.frame(1100);
      controller.pause(); controller.step(); controller.resume();
      if (repeat === 0) controller.runToEnd();
      else for (let now = 1200; controller.getSnapshot().playback.kind === 'running'; now += 250) scheduler.frame(now);
      expect(controller.getSnapshot()).toEqual(final);
      expect(controller.getSnapshot().generation.environment).toBe(environment);
      expect(JSON.stringify(environment)).toBe(before);
      expect(Object.isFrozen(environment)).toBe(true);
      expect(Object.isFrozen(environment.passages)).toBe(true);
    }
    expect(injectedSolver).toHaveBeenCalledTimes(1);
  });

  it.each(['solve', 'replay'] as const)('leaves a listener-started %s animated when runToEnd completes', operation => {
    const { controller, scheduler, injectedSolver } = setup();
    let completions = 0;
    controller.on(event => {
      if (event.type !== 'solved') return;
      completions += 1;
      // Bound the callback so a regression fails assertions instead of hanging the suite.
      if (completions === 1) controller[operation]();
    });
    controller.runToEnd();
    expect(completions).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({ playback: { kind: 'running' }, traceState: initialTraceState });
    expect(injectedSolver).toHaveBeenCalledTimes(operation === 'solve' ? 2 : 1);
    expect(scheduler.callbacks.size).toBe(1);
    scheduler.frame(0);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(0);
    scheduler.frame(100);
    expect(controller.getSnapshot().traceState.stepIndex).toBe(6);
  });

  it('announces only the replacing solver when a state-change listener starts another solve', () => {
    const astarId = 'astar' as SolverId;
    const controller = createController({
      generator: recursiveBacktracker,
      solvers: [{ id: solverId, label: 'Injected solver', solver: bfs, resumable: bfsResumable }, { id: astarId, label: 'A* (Manhattan)', solver: astar, resumable: bfsResumable }],
      scheduler: new FakeScheduler(), onRender: vi.fn(), initialOptions,
    });
    const started: SolverId[] = [];
    controller.on(event => {
      if (event.type === 'solve-started') started.push(event.solverId);
      if (event.type === 'state-change' && event.playback.kind === 'running' && event.playback.solverLabel === 'Injected solver') controller.solve(astarId);
    });
    controller.solve(solverId);
    expect(started).toEqual([astarId]);
  });

  it('ignores replay without a completed result and clears old logs on reset and generate', () => {
    const { controller, scheduler } = setup();
    controller.replay();
    expect(controller.getSnapshot().playback.kind).toBe('idle');
    controller.solve(); controller.replay();
    expect(scheduler.callbacks.size).toBe(1);
    controller.runToEnd(); controller.reset(); controller.replay();
    expect(controller.getSnapshot().playback.kind).toBe('idle');
    controller.runToEnd(); controller.generate(); controller.replay();
    expect(controller.getSnapshot().playback.kind).toBe('idle');
  });

  it('selects injected solvers by id and preserves the current selection', () => {
    const scheduler = new FakeScheduler();
    const first = vi.fn(bfsResumable);
    const second = vi.fn(bfsResumable);
    const secondId = 'second' as SolverId;
    const controller = createController({ generator: recursiveBacktracker, solvers: [
      { id: solverId, label: 'First', solver: bfs, resumable: first }, { id: secondId, label: 'Second', solver: bfs, resumable: second },
    ], scheduler, onRender: vi.fn(), initialOptions });
    controller.solve(secondId); controller.runToEnd();
    controller.reset(); controller.step();
    expect(second).toHaveBeenCalledTimes(2);
    expect(first).not.toHaveBeenCalled();
    expect(controller.getSnapshot().selectedSolver).toBe(secondId);
    expect(() => controller.solve('missing' as SolverId)).toThrow(RangeError);
    expect(controller.getSnapshot().playback.kind).toBe('paused');
  });

  it('unsubscribes listeners and disposes frames, iterator and callbacks; later calls are no-ops', () => {
    const finalized = vi.fn();
    const solver: Solver = function* (maze) {
      try { yield { type: 'visit', node: maze.start }; }
      finally { finalized(); }
      return { outcome: 'found', path: [maze.start], exploredCount: 1, cost: 0, space: 'discrete-graph' };
    };
    const { controller, scheduler, onRender } = setup(solver);
    const listener = vi.fn();
    const unsubscribe = controller.on(listener);
    controller.step(); unsubscribe(); listener.mockClear();
    controller.resume();
    const stale = [...scheduler.callbacks.values()][0];
    const rendered = onRender.mock.calls.length;
    controller.dispose(); controller.dispose();
    const before = controller.getSnapshot();
    controller.generate(); controller.solve(); controller.pause(); controller.resume(); controller.reset();
    controller.step(); controller.replay(); controller.setSpeed(NaN); controller.runToEnd(); controller.on(listener);
    stale?.(1000);
    expect(controller.getSnapshot()).toEqual(before);
    expect(finalized).not.toHaveBeenCalled(); // Sessions are discarded; the contract has no return hook.
    expect(listener).not.toHaveBeenCalled();
    expect(onRender).toHaveBeenCalledTimes(rendered);
    expect(scheduler.callbacks.size).toBe(0);
  });

  it('can dispose from a synchronous step listener without hanging runToEnd', () => {
    const { controller } = setup();
    controller.on(event => { if (event.type === 'step') controller.dispose(); });
    controller.runToEnd();
    expect(controller.getSnapshot().traceState.stepIndex).toBe(1);
  });
});

it('creates the browser scheduler only when its factory is called', () => {
  const request = vi.fn(() => 42);
  const cancel = vi.fn();
  vi.stubGlobal('requestAnimationFrame', request);
  vi.stubGlobal('cancelAnimationFrame', cancel);
  try {
    const scheduler = createAnimationFrameScheduler();
    const callback = vi.fn();
    expect(scheduler.request(callback)).toBe(42);
    expect(request).toHaveBeenCalledExactlyOnceWith(callback);
    scheduler.cancel(42);
    expect(cancel).toHaveBeenCalledExactlyOnceWith(42);
  } finally { vi.unstubAllGlobals(); }
});


it('switches an active solve to terrain on the same seed and dimensions, then reports its path cost', () => {
  const scheduler = new FakeScheduler();
  const controller = createController({ generator: generateEnvironment, solvers: solverRegistry, scheduler, onRender: vi.fn(),
    initialOptions: { ...initialOptions, kind: 'wall-maze' } });
  const events: ControllerEvent[] = [];
  controller.on(event => events.push(event));
  controller.solve(); scheduler.frame(0); scheduler.frame(100);
  expect(controller.getSnapshot().traceState.stepIndex).toBeGreaterThan(0);
  controller.generate({ kind: 'terrain' });
  expect(controller.getSnapshot()).toMatchObject({ traceState: initialTraceState, playback: { kind: 'idle' },
    generation: { seed: initialOptions.seed, environment: { kind: 'terrain', rows: 5, cols: 5 } } });
  expect(scheduler.callbacks.size).toBe(0);
  expect(events.at(-1)?.type).toBe('generated');
  controller.solve('dijkstra' as SolverId); controller.runToEnd();
  const { generation, traceState, playback } = controller.getSnapshot();
  expect(playback).toMatchObject({ kind: 'finished', outcome: 'found', pathCost: pathCost(generation.environment, traceState.path ?? []) });
  controller.dispose();
});

it.each(['idle', 'running', 'paused'] as const)('preserves %s intent and provenance on edit', kind => {
  const { controller, events, scheduler, onRender } = setup();
  if (kind !== 'idle') { controller.solve(); scheduler.frame(0); scheduler.frame(100); }
  if (kind === 'paused') controller.pause();
  const before = controller.getSnapshot();
  const changed = setGoal(before.generation.environment, { row: 3, col: 2 });
  if (!changed.ok) throw new Error(changed.error.detail);
  events.length = 0;
  const renders = onRender.mock.calls.length;
  controller.edit(changed.value);
  expect(controller.getSnapshot()).toMatchObject({ edited: true, playback: { kind }, generation: { environment: changed.value } });
  expect(onRender).toHaveBeenCalledTimes(renders + 1);
  expect(scheduler.callbacks.size).toBe(kind === 'running' ? 1 : 0);
  if (kind === 'idle') {
    expect(controller.getSnapshot().traceState).toBe(initialTraceState);
    expect(events).toEqual([{ type: 'edited', environment: changed.value }]);
  } else {
    expect(controller.getSnapshot().traceState.visited).toEqual(before.traceState.visited);
    expect(events[0]).toMatchObject({ type: 'step', event: { type: 'edit' } });
  }
  controller.dispose();
});

it('updates a finished path immediately for a visited goal and resumes for an unexplored goal', () => {
  const { controller, scheduler, events } = setup(bfs, options => ({ ...recursiveBacktracker(options), environment: comparisonMaze }));
  const near = setGoal(comparisonMaze, { row: 0, col: 1 });
  if (!near.ok) throw new Error('goal');
  controller.edit(near.value); controller.runToEnd();
  const visitedGoal = setGoal(near.value, { row: 0, col: 1 });
  if (!visitedGoal.ok) throw new Error('goal');
  events.length = 0;
  controller.edit(visitedGoal.value);
  expect(controller.getSnapshot().playback).toMatchObject({ kind: 'finished', outcome: 'found', pathLength: 2 });
  expect(events.some(event => event.type === 'solved')).toBe(true);
  controller.edit(comparisonMaze);
  expect(controller.getSnapshot().playback).toMatchObject({ kind: 'running', solverLabel: 'Injected solver' });
  expect(scheduler.callbacks.size).toBe(1);
  controller.runToEnd();
  expect(controller.getSnapshot().traceState.path?.at(-1)).toBe(comparisonMaze.goal);
});

it.each(['reset', 'generate'] as const)('discards the session on %s so later edits stay idle', method => {
  const { controller } = setup();
  controller.runToEnd(); controller[method]();
  controller.edit(controller.getSnapshot().generation.environment);
  expect(controller.getSnapshot().playback.kind).toBe('idle');
  expect(controller.getSnapshot().traceState).toBe(initialTraceState);
});

it('folds paused invalidation immediately and replays edits from the solve environment', () => {
  const { controller, scheduler, events, onRender } = setup(bfs, options => ({ ...recursiveBacktracker(options), environment: comparisonMaze }));
  controller.solve(); scheduler.frame(0); scheduler.frame(200); controller.pause();
  const wall = addObstacles(comparisonMaze, { row: 0, col: 1 }, 0);
  if (!wall.ok) throw new Error('wall');
  events.length = 0;
  controller.edit(wall.value);
  const invalid = events.find(event => event.type === 'step' && event.event.type === 'invalidate');
  expect(invalid).toBeDefined();
  if (invalid?.type === 'step' && invalid.event.type === 'invalidate') {
    for (const node of invalid.event.nodes) expect(controller.getSnapshot().traceState.visited.has(node)).toBe(false);
  }
  expect(scheduler.callbacks.size).toBe(0);
  const goal = setGoal(wall.value, { row: 4, col: 3 });
  if (!goal.ok) throw new Error('goal');
  controller.edit(goal.value); controller.runToEnd();
  const live = controller.getSnapshot().traceState;
  const view: MazeViewModel | undefined = onRender.mock.calls.at(-1)?.[0];
  controller.replay();
  scheduler.frame(0); scheduler.frame(100);
  const beforeEditView: MazeViewModel | undefined = onRender.mock.calls.at(-1)?.[0];
  expect(beforeEditView?.goal).toBe(comparisonMaze.goal);
  const originalView = selectViewModel(comparisonMaze, initialTraceState, controller.getSnapshot().playback);
  expect(beforeEditView?.cells.map(cell => cell.wallMask)).toEqual(originalView.cells.map(cell => cell.wallMask));
  expect(beforeEditView?.goal).not.toBe(view?.goal);
  expect(beforeEditView?.cells.map(cell => cell.wallMask)).not.toEqual(view?.cells.map(cell => cell.wallMask));
  controller.runToEnd();
  expect(controller.getSnapshot().traceState).toEqual(live);
  expect(onRender.mock.calls.at(-1)?.[0]).toEqual(view);
  controller.replay(); scheduler.frame(0); scheduler.frame(100);
  let restored = false;
  const stop = controller.on(event => { if (event.type === 'step' && event.event.type === 'edit') {
    expect(event.traceState.visited).toEqual(live.visited); restored = true;
  } });
  controller.edit(goal.value);
  stop();
  expect(restored).toBe(true);
  expect(controller.getSnapshot().playback.kind).toBe('finished');
  const after = controller.getSnapshot().traceState;
  controller.replay(); controller.runToEnd();
  expect(controller.getSnapshot().traceState).toEqual(after);
});

it.each(solverRegistry)('resumes valid paths with $id after wall, goal and cost edits', descriptor => {
  for (const kind of ['wall', 'wall-cut', 'goal', 'cost'] as const) {
    const controller = createController({ generator: options => {
      const generated = generateEnvironment(options);
      return kind === 'wall-cut' ? { ...generated, environment: comparisonMaze } : generated;
    }, solvers: [descriptor], scheduler: new FakeScheduler(), onRender: vi.fn(),
      initialOptions: { ...initialOptions, kind: kind === 'cost' ? 'terrain' : 'wall-maze' } });
    for (let i = 0; i < 8; i++) controller.step();
    const env = controller.getSnapshot().generation.environment;
    const changed = kind === 'goal' ? setGoal(env, { row: 3, col: 2 }) : kind === 'wall'
      ? removeObstacles(env, { row: 2, col: 2 }, 1) : addObstacles(env, { row: 2, col: 2 }, kind === 'wall-cut' ? 0 : 1);
    if (!changed.ok) throw new Error('edit');
    controller.edit(changed.value); controller.runToEnd();
    const { playback, traceState } = controller.getSnapshot();
    expect(playback).toMatchObject({ kind: 'finished', outcome: 'found', pathCost: pathCost(changed.value, traceState.path ?? []) });
    expect(traceState.path?.at(-1)).toBe(changed.value.goal);
    for (let i = 1; i < (traceState.path?.length ?? 0); i++) {
      expect(openNeighbours(changed.value, traceState.path![i - 1]!)).toContain(traceState.path![i]);
    }
  }
});

it('reports unreachable after an edit walls off the goal', () => {
  const { controller, events, scheduler } = setup();
  const environment = controller.getSnapshot().generation.environment;
  const changed = addObstacles(environment, { row: environment.rows - 1, col: environment.cols - 1 }, 0);
  if (!changed.ok) throw new Error(changed.error.detail);
  expect(changed.value.passages[changed.value.goal]).toBe(0);
  controller.edit(changed.value);
  controller.solve();
  controller.runToEnd();
  expect(controller.getSnapshot()).toMatchObject({
    edited: true,
    generation: { environment: changed.value },
    playback: { kind: 'finished', outcome: 'unreachable' },
  });
  expect(events.at(-1)).toMatchObject({ type: 'solved', result: { outcome: 'unreachable', path: [] } });
  expect(scheduler.callbacks.size).toBe(0);
  controller.dispose();
});

it('does not announce an edit or generation that a state-change listener replaced', () => {
  const { controller, events } = setup();
  const original = controller.getSnapshot().generation.environment;
  const changed = setGoal(original, { row: 3, col: 2 });
  if (!changed.ok) throw new Error(changed.error.detail);
  controller.step();
  let replace = true;
  controller.on(event => {
    if (replace && (event.type === 'step' || (event.type === 'state-change' && event.playback.kind === 'idle'))) { replace = false; controller.generate({ seed: 'replacement' }); }
  });
  events.length = 0;
  controller.edit(changed.value);
  const current = controller.getSnapshot();
  expect(events.filter(event => event.type === 'edited' || event.type === 'generated')).toEqual([{ type: 'generated', generation: current.generation }]);
  expect(current.edited).toBe(false);
  replace = true;
  events.length = 0;
  controller.generate({ seed: 'outer' });
  const generated = events.filter(event => event.type === 'generated');
  expect(generated).toEqual([{ type: 'generated', generation: controller.getSnapshot().generation }]);
  expect(controller.getSnapshot().generation.seed).toBe('replacement');
  controller.dispose();
});

it('keeps a cancelled playback when a listener edits after abandonment', () => {
  const { controller } = setup();
  const changed = setGoal(controller.getSnapshot().generation.environment, { row: 3, col: 2 });
  if (!changed.ok) throw new Error('goal');
  controller.solve();
  controller.on(event => {
    if (event.type === 'state-change' && event.playback.kind === 'finished' && event.playback.outcome === 'cancelled') controller.edit(changed.value);
  });
  controller.generate();
  expect(controller.getSnapshot()).toMatchObject({ edited: true, playback: { kind: 'finished', outcome: 'cancelled' }, generation: { environment: changed.value } });
});
