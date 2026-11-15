import type { GenerationResult, EnvironmentOptions } from '../generate/contract.js';
import type { SolverId } from '../model/wall-maze.js';
import type { Environment } from '../model/environment.js';
import { mergeEnvironmentOptions } from './merge-environment-options.js';
import { selectViewModel } from '../render/select-view-model.js';
import type { MazeViewModel } from '../render/view-model.js';
import { cancelledResult, type ResumableSearch, type SolveResult, type SolverDescriptor, type TraceEvent } from '../search/contract.js';
import { applyTraceEvent, initialTraceState, selectTraceEnvironment, type TraceState } from '../trace/trace-state.js';
import { advanceAccumulator } from './accumulator.js';
import type { FrameHandle, FrameScheduler } from './frame-scheduler.js';
import { finishPlayback, pausePlayback, resumePlayback, type PlaybackState } from './playback-state.js';

export type MazeGeneration = GenerationResult<Environment, EnvironmentOptions>;
export type ControllerEvent =
  | { readonly type: 'edited'; readonly environment: Environment }
  | { readonly type: 'generated'; readonly generation: MazeGeneration }
  | { readonly type: 'solve-started'; readonly solverId: SolverId; readonly solverLabel: string }
  | { readonly type: 'step'; readonly event: TraceEvent; readonly traceState: TraceState }
  | { readonly type: 'solved'; readonly result: SolveResult }
  | { readonly type: 'state-change'; readonly playback: PlaybackState };
export type ControllerListener = (event: ControllerEvent) => void;
export interface ControllerOptions {
  readonly generator: (options: EnvironmentOptions) => MazeGeneration;
  readonly solvers: readonly SolverDescriptor[];
  readonly scheduler: FrameScheduler;
  readonly onRender: (viewModel: MazeViewModel) => void;
  readonly initialOptions: EnvironmentOptions;
}
export interface ControllerSnapshot {
  readonly edited: boolean;
  readonly generation: MazeGeneration;
  readonly traceState: TraceState;
  readonly playback: PlaybackState;
  readonly stepsPerSecond: number;
  readonly selectedSolver: SolverId | null;
}
/**
 * Imperative playback handle. Invalid speed/solver configuration is a programmer error;
 * validate user input with Result at the mount boundary before calling these methods.
 * solve/step/runToEnd throw RangeError if no registered solver is available when starting.
 */
export interface CornrowController {
  edit(environment: Environment): void;
  generate(options?: Partial<EnvironmentOptions>): void;
  /** @throws RangeError for an unknown/missing solver, before changing playback. */
  solve(solverId?: SolverId): void;
  pause(): void;
  resume(): void;
  reset(): void;
  step(): void;
  replay(): void;
  /** @throws RangeError for non-finite/non-positive speed; the previous speed is retained. */
  setSpeed(stepsPerSecond: number): void;
  runToEnd(): void;
  getSnapshot(): ControllerSnapshot;
  on(listener: ControllerListener): () => void;
  dispose(): void;
}

/** The controller owns playback only: generation, solver and time are injected. */
export function createController({ generator, solvers, scheduler, onRender, initialOptions }: ControllerOptions): CornrowController {
  let options = { ...initialOptions };
  let generation = generator(options);
  let traceState = initialTraceState;
  let playback: PlaybackState = { kind: 'idle' };
  let selected = solvers[0] ?? null;
  let session: ResumableSearch | null = null;
  let solveEnvironment: Environment | null = null;
  let log: TraceEvent[] = [];
  let result: SolveResult | null = null;
  let replayIndex: number | null = null;
  let stepsPerSecond = 60;
  let carryMs = 0;
  let previousMs: number | null = null;
  let pending: FrameHandle | null = null;
  let frameVersion = 0;
  let disposed = false;
  let edited = false;
  // Bumped by generate() and edit() so a call can tell that a listener replaced it mid-way.
  let operation = 0;
  const listeners = new Set<ControllerListener>();
  const active = (): boolean => playback.kind === 'running' || playback.kind === 'paused';
  const emit = (event: ControllerEvent): void => { for (const listener of [...listeners]) listener(event); };
  const render = (): void => { if (!disposed) onRender(selectViewModel(selectTraceEnvironment(traceState, solveEnvironment ?? generation.environment), traceState, playback)); };
  function setPlayback(next: PlaybackState): void {
    playback = next;
    emit({ type: 'state-change', playback });
  }
  function cancelFrame(): void {
    frameVersion += 1;
    if (pending !== null) scheduler.cancel(pending);
    pending = null;
    previousMs = null;
  }
  function abandon(): void {
    cancelFrame();
    session = null;
    replayIndex = null;
    solveEnvironment = null;
  }
  function finish(completed: SolveResult): void {
    replayIndex = null;
    result = completed;
    cancelFrame();
    setPlayback(finishPlayback(completed));
    emit({ type: 'solved', result: completed });
  }
  function consume(): void {
    let event: TraceEvent;
    if (replayIndex !== null) {
      const recorded = log[replayIndex];
      if (recorded === undefined) {
        if (result !== null) finish(result);
        return;
      }
      event = recorded;
      replayIndex += 1;
    } else {
      if (session === null) return;
      const next = session.next();
      if (next.done) { finish(next.value); return; }
      // Own the recorded path so a caller cannot change a replay through a yielded array.
      event = next.value.type === 'path' ? { type: 'path', path: [...next.value.path] } : { ...next.value };
      log.push(event);
    }
    traceState = applyTraceEvent(traceState, event);
    emit({ type: 'step', event, traceState });
  }
  function requestFrame(): void {
    if (disposed || playback.kind !== 'running' || pending !== null) return;
    const version = frameVersion;
    pending = scheduler.request(nowMs => {
      if (disposed || version !== frameVersion || playback.kind !== 'running') return;
      pending = null;
      const elapsedMs = previousMs === null ? 0 : nowMs - previousMs;
      previousMs = nowMs;
      const advanced = advanceAccumulator({ carryMs, elapsedMs, stepsPerSecond });
      carryMs = advanced.carryMs;
      for (let index = 0; index < advanced.steps && playback.kind === 'running' && version === frameVersion; index += 1) consume();
      render();
      requestFrame();
    });
  }
  function begin(kind: 'running' | 'paused', solverId?: SolverId): void {
    const descriptor = solverId === undefined ? selected : solvers.find(entry => entry.id === solverId);
    if (descriptor === undefined || descriptor === null) throw new RangeError('Unknown or missing solver');
    abandon();
    selected = descriptor;
    traceState = initialTraceState;
    log = [];
    result = null;
    carryMs = 0;
    const started = descriptor.resumable(generation.environment, generation.environment);
    session = started;
    solveEnvironment = generation.environment;
    setPlayback({ kind, solverLabel: descriptor.label });
    // A state-change listener may have replaced this solve; announcing it now would arrive after the replacement's start.
    if (session !== started) return;
    emit({ type: 'solve-started', solverId: descriptor.id, solverLabel: descriptor.label });
  }
  const controller: CornrowController = {
    generate(nextOptions = {}) {
      if (disposed) return;
      const current = ++operation;
      const wasActive = active();
      abandon();
      if (wasActive) setPlayback(finishPlayback(cancelledResult(traceState.visited.size)));
      if (operation !== current) return;
      options = mergeEnvironmentOptions(options, nextOptions);
      generation = generator(options);
      edited = false;
      traceState = initialTraceState;
      log = []; result = null; carryMs = 0;
      setPlayback({ kind: 'idle' });
      // A state-change listener may have replaced this generation; announcing it now would contradict the snapshot.
      if (operation !== current) return;
      emit({ type: 'generated', generation });
      render();
    },
    edit(environment) {
      if (disposed) return;
      const current = ++operation;
      const wasReplay = replayIndex !== null;
      if (wasReplay) {
        cancelFrame();
        replayIndex = null;
        traceState = log.reduce(applyTraceEvent, initialTraceState);
      }
      generation = { ...generation, environment };
      edited = true;
      if (session !== null) {
        const applied = session.applyEdit(environment);
        for (const yielded of applied.events) {
          const event = yielded.type === 'path' ? { ...yielded, path: [...yielded.path] } : { ...yielded };
          log.push(event);
          traceState = applyTraceEvent(traceState, event);
          emit({ type: 'step', event, traceState });
          if (operation !== current) return;
        }
        if (wasReplay || playback.kind === 'finished') {
          carryMs = 0;
          previousMs = null;
          if (applied.hasMoreToSearch) {
            result = null;
            setPlayback({ kind: 'running', solverLabel: selected!.label });
            if (operation !== current) return;
          } else {
            const completed = session.next();
            if (!completed.done) throw new Error('Completed edit must re-emit its result');
            result = completed.value;
            cancelFrame();
            setPlayback(finishPlayback(completed.value));
            if (operation !== current) return;
            emit({ type: 'solved', result: completed.value });
            if (operation !== current) return;
          }
        }
      }
      emit({ type: 'edited', environment });
      if (operation !== current) return;
      render();
      requestFrame();
    },
    solve(solverId) {
      if (disposed) return;
      begin('running', solverId);
      render(); requestFrame();
    },
    pause() {
      if (disposed || playback.kind !== 'running') return;
      cancelFrame(); setPlayback(pausePlayback(playback)); render();
    },
    resume() {
      if (disposed || playback.kind !== 'paused') return;
      previousMs = null;
      setPlayback(resumePlayback(playback)); render(); requestFrame();
    },
    reset() {
      if (disposed) return;
      abandon();
      traceState = initialTraceState;
      log = []; result = null; carryMs = 0;
      setPlayback({ kind: 'idle' }); render();
    },
    step() {
      if (disposed || playback.kind === 'running' || playback.kind === 'finished') return;
      if (playback.kind === 'idle') begin('paused');
      consume(); render();
    },
    replay() {
      if (disposed || playback.kind !== 'finished' || result === null || result.outcome === 'cancelled' || selected === null) return;
      cancelFrame();
      traceState = initialTraceState;
      carryMs = 0;
      replayIndex = 0;
      setPlayback({ kind: 'running', solverLabel: selected.label });
      render(); requestFrame();
    },
    setSpeed(speed) {
      if (disposed) return;
      if (!Number.isFinite(speed) || speed <= 0) throw new RangeError('Speed must be finite and positive');
      stepsPerSecond = speed;
    },
    runToEnd() {
      if (disposed || playback.kind === 'finished') return;
      if (playback.kind === 'idle') begin('paused');
      cancelFrame();
      const version = frameVersion;
      while (!disposed && version === frameVersion && active() && (session !== null || replayIndex !== null)) consume();
      render();
    },
    getSnapshot: () => ({ generation, edited, traceState, playback, stepsPerSecond, selectedSolver: selected?.id ?? null }),
    on(listener) {
      if (!disposed) listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abandon(); listeners.clear();
    },
  };
  render();
  return controller;
}
