import { expect, it, vi } from 'vitest';
import { openCorridorMaze as maze } from '../model/fixtures';
import { toNodeId } from '../model/wall-maze';
import { initialTraceState } from '../trace/trace-state';
import { createCanvasSurface } from './canvas-surface';
import { drawMaze } from './draw-maze';
import { palette } from './palette';
import { RecordingSurface } from './recording-surface';
import { selectViewModel } from './select-view-model';
import type { PlaybackStatus } from './view-model';

function render(playback: PlaybackStatus = { kind: 'idle' }, withPath = true): RecordingSurface {
  const surface = new RecordingSurface({ width: 500, height: 400 });
  drawMaze(surface, selectViewModel(maze, {
    ...initialTraceState, visited: new Set([maze.start]), frontier: new Set([toNodeId(maze, 1)]),
    current: maze.start, path: withPath ? [maze.start, toNodeId(maze, 1), toNodeId(maze, 2)] : null,
  }, playback));
  return surface;
}

it('draws background, explored fills, path, walls, shaped endpoints and current in fixed order', () => {
  const { calls } = render();
  expect(calls.map(call => call.color)).toEqual([
    palette.background, palette.visited, palette.visited, palette.visited,
    palette.path, palette.walls, palette.start, palette.goal, palette.current,
  ]);
  const path = calls.find(call => call.method === 'polyline' && call.color === palette.path);
  expect(path).toMatchObject({ points: [{ x: 90, y: 40 }, { x: 170, y: 40 }, { x: 250, y: 40 }] });
  const walls = calls.find(call => call.method === 'strokeLines');
  if (path?.method !== 'polyline' || walls?.method !== 'strokeLines') throw new Error('Missing geometry');
  expect(path.width).toBeGreaterThan(walls.width);
  expect(walls.segments).toContainEqual({ from: { x: 50, y: 0 }, to: { x: 130, y: 0 } });
  expect(calls.at(-3)?.method).toBe('fillCircle');
  expect(calls.at(-2)?.method).toBe('fillRect');
});

it('distinguishes frontier squares from full visited fills before walls and markers', () => {
  const { calls } = render({ kind: 'running', solverLabel: 'Test' }, false);
  expect(calls.slice(0, 3)).toEqual([
    { method: 'clear', color: palette.background },
    { method: 'fillRect', rect: { x: 50, y: 0, width: 80, height: 80 }, color: palette.visited },
    { method: 'fillRect', rect: { x: 146, y: 16, width: 48, height: 48 }, color: palette.frontier },
  ]);
});

it('tints unreachable exploration and draws an error goal with a cross', () => {
  const { calls } = render({ kind: 'finished', outcome: 'unreachable', pathLength: 0, exploredCount: 1 }, false);
  expect(calls[1]?.color).toBe(palette.failureVisited);
  expect(calls.at(-3)).toMatchObject({ method: 'fillRect', color: palette.error });
  expect(calls.at(-2)).toMatchObject({ method: 'strokeLines', color: palette.error, segments: [expect.anything(), expect.anything()] });
});

it('dims the explored region when cancelled', () => {
  expect(render({ kind: 'finished', outcome: 'cancelled', pathLength: 0, exploredCount: 1 }, false).calls[1]?.color).toBe(palette.cancelled);
});

it('adapts backing size and drawing coordinates to injected device pixel ratios without a DOM', () => {
  const canvas = { width: 300, height: 150, style: { width: '', height: '' } };
  const ctx = {
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    fillStyle: '', strokeStyle: '', lineWidth: 0,
  };
  // Structural fakes exercise only the Canvas boundary methods used here.
  const surface = createCanvasSurface(canvas as HTMLCanvasElement, ctx as unknown as CanvasRenderingContext2D, 2);
  expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0);
  expect(surface.size()).toEqual({ width: 150, height: 75 });
  surface.resize({ width: 101.5, height: 50.5, dpr: 1.5 });
  expect(canvas).toEqual({ width: 152, height: 76, style: { width: '101.5px', height: '50.5px' } });
  expect(ctx.setTransform).toHaveBeenLastCalledWith(1.5, 0, 0, 1.5, 0, 0);
  surface.clear('#fff');
  expect(ctx.fillRect).toHaveBeenLastCalledWith(0, 0, 101.5, 50.5);
  surface.fillRect({ x: 5, y: 6, width: 7, height: 8 }, '#123');
  expect(ctx.fillRect).toHaveBeenLastCalledWith(5, 6, 7, 8);
  surface.strokeLines([{ from: { x: 1, y: 2 }, to: { x: 3, y: 4 } }], '#456', 2);
  expect(ctx.moveTo).toHaveBeenLastCalledWith(1, 2);
  expect(ctx.lineTo).toHaveBeenLastCalledWith(3, 4);
  surface.fillCircle({ x: 10, y: 20 }, 3, '#789');
  expect(ctx.arc).toHaveBeenLastCalledWith(10, 20, 3, 0, Math.PI * 2);
  surface.polyline([{ x: 5, y: 6 }, { x: 7, y: 8 }], '#abc', 4);
  expect(ctx.moveTo).toHaveBeenLastCalledWith(5, 6);
  expect(ctx.lineTo).toHaveBeenLastCalledWith(7, 8);
  expect(ctx.strokeStyle).toBe('#abc');
  expect(ctx.lineWidth).toBe(4);
  expect(() => surface.resize({ width: 10, height: 10, dpr: 0 })).toThrow(RangeError);
});
