import { ok, err, type Result } from '../primitives/result.js';
import type { AppearanceError } from '../render/appearance.js';
import { defaultAppearance, mergeAppearance, uiVariables, type AppearancePatch } from './appearance.js';
import { createController, type ControllerListener, type CornrowController } from '../controller/controller.js';
import { createAnimationFrameScheduler, type FrameScheduler } from '../controller/frame-scheduler.js';
import { generateEnvironment } from '../generate/environment.js';
import type { EditError } from '../edit/edit-environment.js';
import { createClickEditing } from './click-editing.js';
import type { CellCoord, SolverId } from '../model/wall-maze.js';
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
import { createTerrainLegend } from './legend.js';
import { normaliseMountOptions, type MountOptions } from './options.js';
import { randomSeed } from './random-seed.js';
import { trackReducedMotion } from './reduced-motion.js';
import { describeOutcome } from './status-text.js';
import { mountStyles } from './styles.js';

export interface MountEditUnavailable {
  readonly kind: 'destroyed' | 'background-mode';
  readonly operation: 'addObstacles' | 'removeObstacles' | 'setGoal';
  readonly detail: string;
}
export interface CornrowHandle {
  addObstacles(cell: CellCoord): Result<void, EditError | MountEditUnavailable>;
  removeObstacles(cell: CellCoord): Result<void, EditError | MountEditUnavailable>;
  setGoal(cell: CellCoord): Result<void, EditError | MountEditUnavailable>;
  setEditRadius(radius: number): void;
  setAppearance(patch: AppearancePatch): Result<void, AppearanceError>;
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
  const initialAppearance = mergeAppearance(defaultAppearance, initialOptions.appearance ?? {});
  let appearance = initialAppearance.ok ? initialAppearance.value : defaultAppearance;
  function applyUi(): void {
    for (const [name, value] of uiVariables(appearance.ui)) wrapper.style.setProperty(name, value);
  }
  applyUi();
  const background = options.mode === 'background';
  wrapper.setAttribute('data-mode', options.mode);
  if (background) { wrapper.style.pointerEvents = 'none'; wrapper.setAttribute('aria-hidden', 'true'); }
  const shadow = wrapper.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = mountStyles;
  const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img');
  const controls = background ? null : createControls(document, options);
  const legend = background ? null : createTerrainLegend(document);
  if (legend) {
    legend.element.hidden = options.environment !== 'terrain';
    legend.update(appearance.render.palette.terrain, appearance.render.palette.terrainPip);
  }
  const status = background ? null : document.createElement('p');
  if (status) { status.className = 'status'; status.setAttribute('aria-live', 'polite'); }
  const fallback = createFallbackSummary(document);
  shadow.append(style, canvas, fallback.element);
  if (controls && legend && status) shadow.append(controls.form, legend.element, status);
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
  let editing: ReturnType<typeof createClickEditing> | null = null;
  let lastKind: string | null = null;
  function updateText(): void {
    if (controller === null) return;
    const snapshot = controller.getSnapshot();
    if (legend) legend.element.hidden = snapshot.generation.environment.kind !== 'terrain';
    const { rows, cols, kind } = snapshot.generation.environment;
    if (kind !== lastKind) { controls?.setEnvironmentKind(kind); lastKind = kind; }
    if (snapshot.playback.kind !== 'idle') editing?.clear();
    const label = solverLabel();
    canvas.setAttribute('aria-label', `${options.label}: ${rows} × ${cols} maze, ${snapshot.edited ? 'edited from seed' : 'seed'} ${snapshot.generation.seed}, ${label}`);
    const outcome = describeOutcome(snapshot.playback, label, snapshot.generation.environment.kind);
    const text = editing?.announcement ? `${editing.announcement}. ${outcome}` : outcome;
    if (status && status.textContent !== text) status.textContent = text;
    controls?.update(snapshot.playback, reduced);
    if (surface === null) fallback.update(snapshot, label);
  }
  function paint(view: MazeViewModel): void {
    if (destroyed) return;
    if (surface) drawMaze(surface, view, appearance.render);
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
    generator: generateEnvironment, solvers: solverRegistry, scheduler, onRender: paint,
    initialOptions: { kind: options.environment, seed: options.seed, rows: options.rows, cols: options.cols, openness: options.openness },
  });
  const playback = controller;
  editing = controls ? createClickEditing({ canvas, surface, controller: playback, disposables, controls,
    getOptions: () => options, onEdited: () => { runningIntent = false; } }) : null;
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
    controls.area.value = String(options.editRadius);
    controls.seed.value = String(options.seed);
    controls.setSize(options.rows, options.cols);
    controls.algorithm.value = options.solver;
    controls.environment.value = options.environment;
    controls.speed.value = String(options.stepsPerSecond);
  }
  function edit(operation: MountEditUnavailable['operation'], tool: 'add' | 'remove' | 'goal', cell: CellCoord): Result<void, EditError | MountEditUnavailable> {
    if (destroyed) return err({ kind: 'destroyed', operation, detail: 'The Cornrow handle has been destroyed.' });
    if (!editing) return err({ kind: 'background-mode', operation, detail: 'Edits are unavailable in background mode because its loop regenerates.' });
    return editing.applyEdit(tool, cell);
  }
  const handle: CornrowHandle = {
    addObstacles: cell => edit('addObstacles', 'add', cell),
    removeObstacles: cell => edit('removeObstacles', 'remove', cell),
    setGoal: cell => edit('setGoal', 'goal', cell),
    setEditRadius(radius) {
      if (destroyed) return;
      options = normaliseMountOptions({ ...options, editRadius: radius }, options.seed);
      if (controls) controls.area.value = String(options.editRadius);
    },
    setAppearance(patch) {
      if (destroyed) return err({ kind: 'destroyed', operation: 'setAppearance', detail: 'The Cornrow handle has been destroyed.' });
      const result = mergeAppearance(appearance, patch);
      if (!result.ok) return result;
      appearance = result.value;
      applyUi();
      legend?.update(appearance.render.palette.terrain, appearance.render.palette.terrainPip);
      redraw();
      return ok(undefined);
    },
    generate(next = {}) {
      if (destroyed) return;
      editing?.clear();
      runningIntent = background;
      loop?.restart();
      options = normaliseMountOptions({ ...options, ...next, mode: options.mode, seed: next.seed ?? randomSeed() }, options.seed);
      syncFields(); playback.setSpeed(options.stepsPerSecond);
      playback.generate({ kind: options.environment, seed: options.seed, rows: options.rows, cols: options.cols, openness: options.openness });
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
      playback.generate({ kind: options.environment, seed: options.seed, rows: options.rows, cols: options.cols, openness: options.openness });
    } });
    disposables.add(() => loop?.dispose());
    reconcilePlayback();
  }
  if (controls) {
    for (const event of ['input', 'change']) disposables.listen(controls.area, event, () => handle.setEditRadius(controls.area.valueAsNumber));
    disposables.listen(controls.generate, 'click', () => handle.generate());
    disposables.listen(controls.solve, 'click', () => handle.solve());
    disposables.listen(controls.pause, 'click', () => playback.getSnapshot().playback.kind === 'paused' ? handle.resume() : handle.pause());
    disposables.listen(controls.reset, 'click', () => handle.reset());
    disposables.listen(controls.form, 'submit', event => {
      event.preventDefault(); handle.generate({ seed: controls.seed.value });
    });
    disposables.listen(controls.seed, 'keydown', event => {
      if ('key' in event && event.key === 'Enter' && !('isComposing' in event && event.isComposing)) {
        event.preventDefault(); handle.generate({ seed: controls.seed.value });
      }
    });
    disposables.listen(controls.speed, 'input', () => {
      options = normaliseMountOptions({ ...options, stepsPerSecond: controls.speed.valueAsNumber }, options.seed);
      playback.setSpeed(options.stepsPerSecond); controls.speed.value = String(options.stepsPerSecond);
    });
    disposables.listen(controls.algorithm, 'change', () => {
      options = normaliseMountOptions({ ...options, solver: controls.algorithm.value as SolverId }, options.seed);
      controls.algorithm.value = options.solver; updateText();
    });
    disposables.listen(controls.environment, 'change', () => {
      handle.generate({ environment: controls.environment.value as 'wall-maze' | 'terrain', seed: controls.seed.value });
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
