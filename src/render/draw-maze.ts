import type { DrawingSurface, Point, Rect, Segment } from './drawing-surface.js';
import { computeLayout } from './layout.js';
import { palette } from './palette.js';
import { WALL_NORTH, WALL_EAST, WALL_SOUTH, WALL_WEST, type MazeViewModel } from './view-model.js';

export function drawMaze(surface: DrawingSurface, view: MazeViewModel): void {
  const { cellSize: size, origin } = computeLayout(view.rows, view.cols, surface.size());
  surface.clear(palette.background);
  if (size === 0) return;
  const rect = (node: number, insetPerSide = 0): Rect => {
    // Remove the inset from both opposing sides of the square.
    const innerSize = size - insetPerSide - insetPerSide;
    return {
      x: origin.x + (node % view.cols) * size + insetPerSide,
      y: origin.y + Math.floor(node / view.cols) * size + insetPerSide,
      width: innerSize, height: innerSize,
    };
  };
  const center = (node: number): Point => {
    const cell = rect(node);
    return { x: cell.x + size / 2, y: cell.y + size / 2 };
  };
  const failure = view.playback.kind === 'finished' && view.playback.outcome === 'unreachable';
  const cancelled = view.playback.kind === 'finished' && view.playback.outcome === 'cancelled';
  const visitedColor = failure ? palette.failureVisited : cancelled ? palette.cancelled : palette.visited;
  view.cells.forEach((cell, node) => {
    if (cell.layer === 'visited' || cell.layer === 'path') surface.fillRect(rect(node), visitedColor);
  });
  // Inset frontier squares differ from the full visited fills even without colour.
  view.cells.forEach((cell, node) => {
    if (cell.layer === 'frontier') surface.fillRect(rect(node, size * 0.2), palette.frontier);
  });
  const wallWidth = Math.min(2, size * 0.06);
  if (view.path !== null && view.path.length > 0) surface.polyline(view.path.map(center), palette.path, size * 0.22);
  const walls: Segment[] = [];
  view.cells.forEach((cell, node) => {
    const { x, y } = rect(node);
    if (cell.wallMask & WALL_NORTH) walls.push({ from: { x, y }, to: { x: x + size, y } });
    if (cell.wallMask & WALL_EAST) walls.push({ from: { x: x + size, y }, to: { x: x + size, y: y + size } });
    if (cell.wallMask & WALL_SOUTH) walls.push({ from: { x, y: y + size }, to: { x: x + size, y: y + size } });
    if (cell.wallMask & WALL_WEST) walls.push({ from: { x, y }, to: { x, y: y + size } });
  });
  surface.strokeLines(walls, palette.walls, wallWidth);
  surface.fillCircle(center(view.start), size * 0.23, palette.start);
  const goalColor = failure ? palette.error : palette.goal;
  if (view.start === view.goal) {
    // An outlined goal square surrounds the start circle without covering it.
    const { x, y, width, height } = rect(view.goal, size * 0.18);
    surface.strokeLines([
      { from: { x, y }, to: { x: x + width, y } },
      { from: { x: x + width, y }, to: { x: x + width, y: y + height } },
      { from: { x: x + width, y: y + height }, to: { x, y: y + height } },
      { from: { x, y: y + height }, to: { x, y } },
    ], goalColor, size * 0.07);
  } else {
    surface.fillRect(rect(view.goal, size * 0.27), goalColor);
  }
  if (failure) {
    const { x, y, width, height } = rect(view.goal, size * 0.15);
    surface.strokeLines([
      { from: { x, y }, to: { x: x + width, y: y + height } },
      { from: { x: x + width, y }, to: { x, y: y + height } },
    ], palette.error, size * 0.1);
  }
  if (view.current !== null) {
    const { x, y, width, height } = rect(view.current, size * 0.12);
    surface.polyline([{ x, y }, { x: x + width, y }, { x: x + width, y: y + height },
      { x, y: y + height }, { x, y }], palette.current, size * 0.07);
  }
}
