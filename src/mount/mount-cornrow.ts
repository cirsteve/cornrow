import { createController, type ControllerListener, type CornrowController } from '../controller/controller.js';
import { createAnimationFrameScheduler, type FrameScheduler } from '../controller/frame-scheduler.js';
import { recursiveBacktracker } from '../generate/recursive-backtracker.js';
import type { SolverId } from '../model/wall-maze.js';
import { createCanvasSurface } from '../render/canvas-surface.js';
import { drawMaze } from '../render/draw-maze.js';
import { selectViewModel } from '../render/select-view-model.js';
import type { MazeViewModel } from '../render/view-model.js';
import { getSolver, solverRegistry } from '../search/registry.js';
import { createBackgroundLoop, type BackgroundLoop } from './background-loop.js';
import { createControls } from './controls.js';
import { Disposables } from './disposables.js';
import { createFallbackSummary } from './fallback-summary.js';
import { trackHostSignals } from './host-signals.js';
import { normaliseMountOptions, type MountOptions } from './options.js';
import { randomSeed } from './random-seed.js';
import { trackReducedMotion } from './reduced-motion.js';
import { describeOutcome } from './status-text.js';
import { mountStyles } from './styles.js';

export interface CornrowHandle {
  generate(options?: MountOptions): void;
  solve(solverId?: SolverId): void;
  pause(): void;
  resume(): void;
  reset(): void;
  on(listener: ControllerListener): () => void;
  destroy(): void;
}

/** Browser APIs are resolved only during a mount. All ownership is local. */
export function mountCornrow(element: HTMLElement, initialOptions: MountOptions = {}): CornrowHandle {
  const document = element.ownerDocument;
  const disposables = new Disposables();
  let options = normaliseMountOptions(initialOptions, initialOptions.seed ?? randomSeed());
  const wrapper = document.createElement('div'); wrapper.setAttribute('data-cornrow', '');
  const background = options.mode === 'background';
  wrapper.setAttribute('data-mode', options.mode);
  if (background) { wrapper.style.pointerEvents = 'none'; wrapper.setAttribute('aria-hidden', 'true'); }
  const shadow = wrapper.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = mountStyles;
  const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img');
  const controls = background ? null : createControls(document, options);
  const status = background ? null : document.createElement('p');
  if (status) { status.className = 'status'; status.setAttribute('aria-live', 'polite'); }
  const fallback = createFallbackSummary(document);
  shadow.append(style, canvas, fallback.element);
  if (controls && status) shadow.append(controls.form, status);
  element.append(wrapper);
  disposables.add(() => wrapper.remove());

  const context = canvas.getContext('2d');
  const dpr = (): number => {
    const value = document.defaultView?.devicePixelRatio ?? 1;
    return Number.isFinite(value) && value > 0 ? value : 1;
  };
  const surface = context === null ? null : createCanvasSurface(canvas, context, dpr());
  canvas.hidden = surface === null; fallback.element.hidden = surface !== null;
  let controller: CornrowController | null = null;
  let destroyed = false;
  let runningIntent = background;
  let loop: BackgroundLoop | null = null;
  let suspended = false;
  let reduced = false;
  const canAnimate = typeof globalThis.requestAnimationFrame === 'function' && typeof globalThis.cancelAnimationFrame === 'function';
  const synchronous = (): boolean => reduced || surface === null || !canAnimate;
  const browserScheduler = canAnimate ? createAnimationFrameScheduler() : null;
  let inertHandle = -1;
  // The controller may start/replay before we can pause or drain it. Gate requests
  // here so synchronous solves and off-screen starts never request even one rAF.
  const source: FrameScheduler = {
    request: callback => !synchronous() && !suspended && runningIntent && browserScheduler
      ? browserScheduler.request(callback) : inertHandle--,
    cancel: handle => { if (handle >= 0) browserScheduler?.cancel(handle); },
  };
  const scheduler = disposables.scheduler(source);
  function solverLabel(): string {
    const snapshot = controller?.getSnapshot();
    const id = snapshot && snapshot.playback.kind !== 'idle' ? snapshot.selectedSolver : options.solver;
    const solver = getSolver(id ?? options.solver);
    return solver.ok ? solver.value.label : 'Breadth-first search';
  }
  function updateText(): void {
    if (controller === null) return;
    const snapshot = controller.getSnapshot();
    const { rows, cols } = snapshot.generation.environment;
    const label = solverLabel();
    canvas.setAttribute('aria-label', `${options.label}: ${rows} × ${cols} maze, seed ${snapshot.generation.seed}, ${label}`);
    const text = describeOutcome(snapshot.playback, label);
    if (status && status.textContent !== text) status.textContent = text;
    controls?.update(snapshot.playback, reduced);
    if (surface === null) fallback.update(snapshot, label);
  }
  function paint(view: MazeViewModel): void {
    if (destroyed) return;
    if (surface) drawMaze(surface, view);
    updateText();
  }
  function redraw(): void {
    if (destroyed || controller === null) return;
    const snapshot = controller.getSnapshot();
    paint(selectViewModel(snapshot.generation.environment, snapshot.traceState, snapshot.playback));
  }
  function resize(): void {
    if (destroyed) return;
    const width = wrapper.getBoundingClientRect().width || 480;
    // A square drawing area follows the host width; controls remain in flow below.
    surface?.resize({ width, height: width, dpr: dpr() });
    redraw();
  }
  resize();
  controller = createController({
    generator: recursiveBacktracker, solvers: solverRegistry, scheduler, onRender: paint,
    initialOptions: { seed: options.seed, rows: options.rows, cols: options.cols },
  });
  const playback = controller;
  disposables.add(() => playback.dispose());
  playback.setSpeed(options.stepsPerSecond);

  function reconcilePlayback(): void {
    if (destroyed) return;
    if (!runningIntent || suspended) { loop?.stop(); playback.pause(); return; }
    if (synchronous()) { loop?.stop(); playback.runToEnd(); return; }
    loop?.start();
    playback.resume();
  }
  reduced = trackReducedMotion(disposables, value => {
    if (destroyed) return;
    reduced = value;
    if (background) {
      loop?.restart();
      reconcilePlayback();
    } else if (reduced) playback.pause();
    else reconcilePlayback();
    updateText();
  });
  trackHostSignals({ wrapper, disposables, resize, suspend: value => {
    suspended = value;
    reconcilePlayback();
  } });

  function syncFields(): void {
    if (!controls) return;
    controls.seed.value = String(options.seed);
    controls.setSize(options.rows, options.cols);
    controls.algorithm.value = options.solver;
    controls.speed.value = String(options.stepsPerSecond);
  }
  const handle: CornrowHandle = {
    generate(next = {}) {
      if (destroyed) return;
      runningIntent = background;
      loop?.restart();
      options = normaliseMountOptions({ ...options, ...next, mode: options.mode, seed: next.seed ?? randomSeed() }, options.seed);
      syncFields(); playback.setSpeed(options.stepsPerSecond);
      playback.generate({ seed: options.seed, rows: options.rows, cols: options.cols });
      if (background) reconcilePlayback();
    },
    solve(id = options.solver) {
      if (destroyed) return;
      options = normaliseMountOptions({ ...options, solver: id }, options.seed);
      if (controls) controls.algorithm.value = options.solver;
      loop?.restart('solving');
      runningIntent = true;
      playback.solve(options.solver);
      reconcilePlayback();
    },
    pause() { if (!destroyed) { runningIntent = false; loop?.stop(); playback.pause(); } },
    resume() {
      if (destroyed || (!background && playback.getSnapshot().playback.kind !== 'paused')) return;
      runningIntent = true; reconcilePlayback();
    },
    reset() { if (!destroyed) { runningIntent = false; loop?.restart(); playback.reset(); } },
    on(listener) { return destroyed ? () => {} : disposables.add(playback.on(listener)); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      disposables.dispose();
    },
  };
  if (background) {
    loop = createBackgroundLoop({ playback, scheduler, regenerate: () => {
      options = normaliseMountOptions({ ...options, seed: randomSeed() }, options.seed);
      playback.generate({ seed: options.seed, rows: options.rows, cols: options.cols });
    } });
    disposables.add(() => loop?.dispose());
    reconcilePlayback();
  }
  if (controls) {
    disposables.listen(controls.generate, 'click', () => handle.generate());
    disposables.listen(controls.solve, 'click', () => handle.solve());
    disposables.listen(controls.pause, 'click', () => playback.getSnapshot().playback.kind === 'paused' ? handle.resume() : handle.pause());
    disposables.listen(controls.reset, 'click', () => handle.reset());
    disposables.listen(controls.form, 'submit', event => {
      event.preventDefault(); handle.generate({ seed: controls.seed.value });
    });
    disposables.listen(controls.speed, 'input', () => {
      options = normaliseMountOptions({ ...options, stepsPerSecond: controls.speed.valueAsNumber }, options.seed);
      playback.setSpeed(options.stepsPerSecond); controls.speed.value = String(options.stepsPerSecond);
    });
    disposables.listen(controls.algorithm, 'change', () => {
      options = normaliseMountOptions({ ...options, solver: controls.algorithm.value as SolverId }, options.seed);
      controls.algorithm.value = options.solver; updateText();
    });
    disposables.listen(controls.size, 'change', () => {
      if (controls.size.value === '') return;
      handle.generate({ rows: Number(controls.size.value), cols: Number(controls.size.value), seed: controls.seed.value });
    });
    disposables.listen(controls.step, 'click', () => {
      if (!reduced || destroyed) return;
      runningIntent = false;
      const state = playback.getSnapshot().playback;
      if (state.kind === 'finished') playback.replay();
      else if (state.kind === 'idle') playback.solve(options.solver);
      playback.pause(); playback.step();
    });
  }
  syncFields();
  redraw();
  return handle;
}
