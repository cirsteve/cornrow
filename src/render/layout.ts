import type { Point, Size } from './drawing-surface';

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
