import type { GenerationResult, EnvironmentOptions } from '../generate/contract.js';
import type { SolverId } from '../model/wall-maze.js';
import type { Environment } from '../model/environment.js';
import { mergeEnvironmentOptions } from './merge-environment-options.js';
import { selectViewModel } from '../render/select-view-model.js';
import type { MazeViewModel } from '../render/view-model.js';
import { cancelledResult, type SolveResult, type SolverDescriptor, type TraceEvent } from '../search/contract.js';
import { applyTraceEvent, initialTraceState, type TraceState } from '../trace/trace-state.js';
import { advanceAccumulator } from './accumulator.js';
import type { FrameHandle, FrameScheduler } from './frame-scheduler.js';
import { finishPlayback, pausePlayback, resumePlayback, type PlaybackState } from './playback-state.js';

export type MazeGeneration = GenerationResult<Environment, EnvironmentOptions>;
export type ControllerEvent =
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
  let iterator: Generator<TraceEvent, SolveResult> | null = null;
  let log: TraceEvent[] = [];
  let result: SolveResult | null = null;
  let replayIndex: number | null = null;
  let stepsPerSecond = 60;
  let carryMs = 0;
  let previousMs: number | null = null;
  let pending: FrameHandle | null = null;
  let frameVersion = 0;
  let disposed = false;
  const listeners = new Set<ControllerListener>();
  const active = (): boolean => playback.kind === 'running' || playback.kind === 'paused';
  const emit = (event: ControllerEvent): void => { for (const listener of [...listeners]) listener(event); };
  const render = (): void => { if (!disposed) onRender(selectViewModel(generation.environment, traceState, playback)); };
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
    const abandoned = iterator;
    iterator = null;
    replayIndex = null;
    abandoned?.return(cancelledResult(traceState.visited.size));
  }
  function finish(completed: SolveResult): void {
    iterator = null;
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
      if (iterator === null) return;
      const next = iterator.next();
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
    const started = descriptor.solver(generation.environment, generation.environment);
    iterator = started;
    setPlayback({ kind, solverLabel: descriptor.label });
    // A state-change listener may have replaced this solve; announcing it now would arrive after the replacement's start.
    if (iterator !== started) return;
    emit({ type: 'solve-started', solverId: descriptor.id, solverLabel: descriptor.label });
  }
  const controller: CornrowController = {
    generate(nextOptions = {}) {
      if (disposed) return;
      const wasActive = active();
      abandon();
      if (wasActive) setPlayback(finishPlayback(cancelledResult(traceState.visited.size)));
      options = mergeEnvironmentOptions(options, nextOptions);
      generation = generator(options);
      traceState = initialTraceState;
      log = []; result = null; carryMs = 0;
      setPlayback({ kind: 'idle' });
      emit({ type: 'generated', generation });
      render();
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
      while (!disposed && version === frameVersion && active() && (iterator !== null || replayIndex !== null)) consume();
      render();
    },
    getSnapshot: () => ({ generation, traceState, playback, stepsPerSecond, selectedSolver: selected?.id ?? null }),
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
