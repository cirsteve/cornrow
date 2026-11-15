import type { CornrowController } from '../controller/controller.js';
import { addObstacles, removeObstacles, setGoal, type EditError } from '../edit/edit-environment.js';
import type { CellCoord } from '../model/wall-maze.js';
import { ok, type Result } from '../primitives/result.js';
import type { CanvasSurface } from '../render/canvas-surface.js';
import { cellAtPoint, computeLayout } from '../render/layout.js';
import { isEditTool, type EditTool, type createControls } from './controls.js';
import type { Disposables } from './disposables.js';
import type { NormalisedMountOptions } from './options.js';
import { describeEdit } from './status-text.js';

interface ClickEditingDependencies {
  canvas: HTMLCanvasElement;
  surface: CanvasSurface | null;
  controller: CornrowController;
  disposables: Disposables;
  controls: ReturnType<typeof createControls>;
  getOptions: () => NormalisedMountOptions;
  beforeEdit: () => void;
  afterEdit: () => void;
}

export function createClickEditing({ canvas, surface, controller, disposables, controls, getOptions, beforeEdit, afterEdit }: ClickEditingDependencies) {
  let tool: EditTool = 'none';
  let continuing = false;
  let announcement: Omit<Parameters<typeof describeEdit>[0], 'continuing'> | null = null;
  disposables.listen(controls.click, 'change', () => {
    if (isEditTool(controls.click.value)) tool = controls.click.value;
  });
  function applyEdit(selected: Exclude<EditTool, 'none'>, cell: CellCoord): Result<void, EditError> {
    const env = controller.getSnapshot().generation.environment;
    const result = selected === 'goal' ? setGoal(env, cell)
      : selected === 'add' ? addObstacles(env, cell, getOptions().editRadius)
      : removeObstacles(env, cell, getOptions().editRadius);
    if (!result.ok) return result;
    beforeEdit();
    controller.edit(result.value);
    const playback = controller.getSnapshot().playback;
    continuing = playback.kind === 'running' || playback.kind === 'paused';
    announcement = { tool: selected, kind: env.kind, cell };
    afterEdit();
    return ok(undefined);
  }
  if (surface !== null) disposables.listen(canvas, 'click', event => {
    if (tool === 'none' || !('clientX' in event) || !('clientY' in event)
      || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const env = controller.getSnapshot().generation.environment;
    const size = surface.size();
    const layout = computeLayout(env.rows, env.cols, size);
    const cell = cellAtPoint(layout, env, {
      x: (event.clientX - rect.left) * size.width / rect.width,
      y: (event.clientY - rect.top) * size.height / rect.height,
    });
    if (cell !== null) applyEdit(tool, cell);
  });
  return {
    applyEdit,
    get announcement() { return announcement === null ? null : describeEdit({ ...announcement, continuing }); },
    get continuing() { return continuing; },
    finish() { continuing = false; },
    clear() { announcement = null; continuing = false; },
  };
}
