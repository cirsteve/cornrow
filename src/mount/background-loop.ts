import type { CornrowController } from '../controller/controller.js';
import type { FrameScheduler } from '../controller/frame-scheduler.js';
import { solverRegistry } from '../search/registry.js';

export type BackgroundPhase =
  | { readonly kind: 'generating'; readonly solverIndex: number }
  | { readonly kind: 'solving'; readonly solverIndex: number }
  | { readonly kind: 'holding'; readonly solverIndex: number; readonly elapsedMs: number };
export interface BackgroundProgress {
  readonly solved: boolean;
  readonly elapsedMs: number;
  readonly solverCount: number;
}

/** Hold time advances only with visible scheduler time, never with a wall timer. */
export function nextBackgroundPhase(phase: BackgroundPhase, progress: BackgroundProgress): BackgroundPhase {
  if (phase.kind === 'generating') return { kind: 'solving', solverIndex: phase.solverIndex };
  if (phase.kind === 'solving') return progress.solved
    ? { kind: 'holding', solverIndex: phase.solverIndex, elapsedMs: 0 } : phase;
  const elapsedMs = phase.elapsedMs + Math.max(0, progress.elapsedMs);
  return elapsedMs >= 2500
    ? { kind: 'generating', solverIndex: (phase.solverIndex + 1) % progress.solverCount }
    : { ...phase, elapsedMs };
}

interface BackgroundLoopOptions {
  readonly playback: CornrowController;
  readonly scheduler: FrameScheduler;
  readonly regenerate: () => void;
}
export interface BackgroundLoop {
  start(): void;
  stop(): void;
  restart(kind?: 'generating' | 'solving'): void;
  dispose(): void;
}

/** Uses the mount's owned scheduler and controller; only holds need extra frames. */
export function createBackgroundLoop({ playback, scheduler, regenerate }: BackgroundLoopOptions): BackgroundLoop {
  let phase: BackgroundPhase = { kind: 'generating', solverIndex: 0 };
  let active = false;
  let pending: number | null = null;
  let previousMs: number | null = null;
  function advance(solved: boolean, elapsedMs: number): BackgroundPhase {
    phase = nextBackgroundPhase(phase, { solved, elapsedMs, solverCount: solverRegistry.length });
    return phase;
  }
  function request(): void {
    if (!active || pending !== null || phase.kind === 'solving') return;
    pending = scheduler.request(now => {
      pending = null;
      if (!active) return;
      const before = phase.kind;
      const next = advance(false, previousMs === null ? 0 : now - previousMs);
      previousMs = now;
      if (before === 'generating') {
        const solver = solverRegistry[phase.solverIndex];
        if (solver) playback.solve(solver.id);
      } else if (next.kind === 'generating') regenerate();
      request();
    });
  }
  const unsubscribe = playback.on(event => {
    if (event.type !== 'solved' || phase.kind !== 'solving') return;
    advance(true, 0);
    previousMs = null;
    request();
  });
  function stop(): void {
    active = false;
    if (pending !== null) scheduler.cancel(pending);
    pending = null; previousMs = null;
  }
  return {
    start() { active = true; request(); },
    stop,
    restart(kind = 'generating') { stop(); phase = { kind, solverIndex: 0 }; },
    dispose() { stop(); unsubscribe(); },
  };
}
