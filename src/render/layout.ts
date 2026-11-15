import type { GridSize, CellCoord } from '../model/wall-maze.js';
import type { Point, Size } from './drawing-surface.js';

export interface MazeLayout { readonly cellSize: number; readonly origin: Point }

/**
 * Zero-sized surfaces are valid while their host is hidden.
 * @throws RangeError for non-positive/non-integer grid dimensions or non-finite/negative
 * surface sizes. These are caller preconditions for this direct-return drawing primitive.
 */
export function computeLayout(rows: number, cols: number, size: Size): MazeLayout {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0
    || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 0 || size.height < 0) {
    throw new RangeError('computeLayout: invalid grid or surface size');
  }
  const cellSize = Math.min(size.width / cols, size.height / rows);
  return { cellSize, origin: { x: (size.width - cols * cellSize) / 2, y: (size.height - rows * cellSize) / 2 } };
}

/** Map a CSS-pixel point to a cell, excluding letterbox margins and the far edges. */
export function cellAtPoint(layout: MazeLayout, grid: GridSize, point: Point): CellCoord | null {
  if (layout.cellSize <= 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const col = Math.floor((point.x - layout.origin.x) / layout.cellSize);
  const row = Math.floor((point.y - layout.origin.y) / layout.cellSize);
  return row >= 0 && row < grid.rows && col >= 0 && col < grid.cols ? { row, col } : null;
}
