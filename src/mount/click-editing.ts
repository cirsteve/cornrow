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
  onEdited: () => void;
}

export function createClickEditing({ canvas, surface, controller, disposables, controls, getOptions, onEdited }: ClickEditingDependencies) {
  let tool: EditTool = 'none';
  let announcement: string | null = null;
  disposables.listen(controls.click, 'change', () => {
    if (isEditTool(controls.click.value)) tool = controls.click.value;
  });
  function applyEdit(selected: Exclude<EditTool, 'none'>, cell: CellCoord): Result<void, EditError> {
    const env = controller.getSnapshot().generation.environment;
    const result = selected === 'goal' ? setGoal(env, cell)
      : selected === 'add' ? addObstacles(env, cell, getOptions().editRadius)
      : removeObstacles(env, cell, getOptions().editRadius);
    if (!result.ok) return result;
    onEdited();
    announcement = describeEdit({ tool: selected, kind: env.kind, cell });
    controller.edit(result.value);
    return ok(undefined);
  }
  if (surface !== null) disposables.listen(canvas, 'click', event => {
    if (tool === 'none' || !(event instanceof MouseEvent)) return;
    const rect = canvas.getBoundingClientRect();
    const env = controller.getSnapshot().generation.environment;
    const layout = computeLayout(env.rows, env.cols, surface.size());
    const cell = cellAtPoint(layout, env, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (cell !== null) applyEdit(tool, cell);
  });
  return { applyEdit, get announcement() { return announcement; }, clear() { announcement = null; } };
}
