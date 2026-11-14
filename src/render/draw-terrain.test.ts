import { expect, it } from 'vitest';
import { ridgeTerrain } from '../model/fixtures.js';
import { toNodeId } from '../model/wall-maze.js';
import { initialTraceState } from '../trace/trace-state.js';
import { drawMaze, terrainPips } from './draw-maze.js';
import { palette } from './palette.js';
import { RecordingSurface } from './recording-surface.js';
import { selectViewModel } from './select-view-model.js';
import type { MazeViewModel, PlaybackStatus } from './view-model.js';

function terrainView(playback: PlaybackStatus = { kind: 'running', solverLabel: 'Test' }): MazeViewModel {
  return selectViewModel(ridgeTerrain, {
    ...initialTraceState,
    visited: new Set([ridgeTerrain.start]), frontier: new Set([toNodeId(ridgeTerrain, 1)]),
    current: ridgeTerrain.start, path: [10, 11, 12, 13, 14].map(node => toNodeId(ridgeTerrain, node)),
  }, playback);
}

it.each([0, 1, 2, 3] as const)('keeps all %s terrain pips clear of the existing cell glyphs', band => {
  const pips = terrainPips(band);
  expect(pips).toHaveLength(band);
  for (const { center: { x, y }, radius } of pips) {
    // A circle outside either axis of the frontier rectangle cannot overlap it.
    expect(x + radius < 0.2 || x - radius > 0.8 || y + radius < 0.2 || y - radius > 0.8).toBe(true);
    // Both possible path directions through a cell have width 0.22.
    expect(Math.abs(x - 0.5) - radius).toBeGreaterThan(0.11);
    expect(Math.abs(y - 0.5) - radius).toBeGreaterThan(0.11);
    expect(Math.hypot(x - 0.5, y - 0.5) - radius).toBeGreaterThan(0.23);
    expect(x + radius < 0.27 || x - radius > 0.73 || y + radius < 0.27 || y - radius > 0.73).toBe(true);
    // Also clear the combined start/goal outline, failure cross and boundary walls.
    expect(Math.min(x, y, 1 - x, 1 - y) - radius).toBeGreaterThan(0.03);
    expect(x + radius < 0.15 || x - radius > 0.85 || y + radius < 0.15 || y - radius > 0.85).toBe(true);
  }
});

it('draws all terrain bands, then pips, overlays, frontier, path, walls, endpoints and current', () => {
  const surface = new RecordingSurface({ width: 150, height: 100 });
  const view = terrainView();
  drawMaze(surface, view);
  expect(surface.calls[0]).toEqual({ method: 'clear', color: palette.background });
  expect(surface.calls.slice(1, 26)).toEqual(view.cells.map((cell, node) => ({
    method: 'fillRect',
    rect: { x: 25 + node % 5 * 20, y: Math.floor(node / 5) * 20, width: 20, height: 20 },
    color: palette.terrain[cell.costBand ?? 0],
  })));
  expect(surface.calls.slice(26, 38)).toHaveLength(12);
  expect(surface.calls.slice(26, 38).every(call => call.method === 'fillCircle' && call.color === palette.walls)).toBe(true);
  expect(surface.calls.slice(38).map(call => call.color)).toEqual([
    ...Array<string>(5).fill(palette.visitedOverlay), palette.terrainMarkers.frontier,
    palette.terrainMarkers.path, palette.walls, palette.terrainMarkers.start,
    palette.terrainMarkers.goal, palette.terrainMarkers.current,
  ]);
  expect(surface.calls.at(-5)).toMatchObject({ method: 'polyline', width: 4.4 });
  expect(surface.calls.at(-4)?.method).toBe('strokeLines');
  expect(surface.calls.at(-3)).toMatchObject({ method: 'fillCircle', radius: 4.6000000000000005 });
  expect(surface.calls.at(-2)).toMatchObject({ method: 'fillRect', rect: { width: 9.2, height: 9.2 } });
});

it.each([13, 14, 28])('draws exactly the band number of corner pips only at >=14px (size %s)', size => {
  const original = terrainView();
  const bands = [0, 1, 2, 3] as const;
  const view: MazeViewModel = { ...original, cells: original.cells.map((cell, node) => ({ ...cell, costBand: bands[node % 4] ?? 0 })) };
  const surface = new RecordingSurface({ width: size * 5, height: size * 5 + 40 });
  drawMaze(surface, view);
  const pips = surface.calls.filter(call => call.method === 'fillCircle').filter(call => call.color === palette.walls);
  if (size === 13) { expect(pips).toEqual([]); return; }
  const counts = Array<number>(25).fill(0);
  for (const pip of pips) {
    const col = Math.floor(pip.center.x / size);
    const row = Math.floor((pip.center.y - 20) / size);
    const node = row * 5 + col;
    counts[node] = (counts[node] ?? 0) + 1;
    const x = pip.center.x / size - col;
    const y = (pip.center.y - 20) / size - row;
    const radius = pip.radius / size;
    expect(x + radius < 0.2 || x - radius > 0.8 || y + radius < 0.2 || y - radius > 0.8).toBe(true);
    expect(Math.abs(x - 0.5) - radius).toBeGreaterThan(0.11);
    expect(Math.abs(y - 0.5) - radius).toBeGreaterThan(0.11);
    expect(Math.hypot(x - 0.5, y - 0.5) - radius).toBeGreaterThan(0.23);
    expect(x + radius < 0.27 || x - radius > 0.73 || y + radius < 0.27 || y - radius > 0.73).toBe(true);
  }
  expect(counts).toEqual(view.cells.map(cell => cell.costBand));
});

it.each([14, 28, 80].flatMap(size => ([1, 2, 3] as const).map(band => ({ size, band }))))(
  'keeps the current outline clear of all $band cost pips at $size px', ({ size, band }) => {
    const original = terrainView();
    const current = toNodeId(ridgeTerrain, 12);
    const view: MazeViewModel = {
      ...original, current,
      cells: original.cells.map((cell, node) => ({ ...cell, costBand: node === current ? band : 0 })),
    };
    const surface = new RecordingSurface({ width: size * 5, height: size * 5 });
    drawMaze(surface, view);
    const pips = surface.calls.filter(call => call.method === 'fillCircle').filter(call => call.color === palette.walls);
    const outline = surface.calls.at(-1);
    if (outline?.method !== 'polyline') throw new Error('Missing current outline');
    expect(outline.color).toBe(palette.terrainMarkers.current);
    expect(pips).toHaveLength(band);
    for (const pip of pips) for (const [index, end] of outline.points.slice(1).entries()) {
      const start = outline.points[index];
      if (!start) throw new Error('Missing outline segment start');
      // Distance to the nearest point of each stroked segment, including its caps.
      const dx = end.x - start.x; const dy = end.y - start.y;
      const t = Math.max(0, Math.min(1, ((pip.center.x - start.x) * dx + (pip.center.y - start.y) * dy) / (dx * dx + dy * dy)));
      const distance = Math.hypot(pip.center.x - start.x - t * dx, pip.center.y - start.y - t * dy);
      expect(distance).toBeGreaterThan(pip.radius + outline.width / 2);
    }
  },
);

it.each<{ playback: PlaybackStatus; overlay: string }>([
  { playback: { kind: 'idle' }, overlay: palette.visitedOverlay },
  { playback: { kind: 'running', solverLabel: 'Test' }, overlay: palette.visitedOverlay },
  { playback: { kind: 'paused', solverLabel: 'Test' }, overlay: palette.visitedOverlay },
  { playback: { kind: 'finished', outcome: 'found', pathLength: 5, pathCost: 11, exploredCount: 20 }, overlay: palette.visitedOverlay },
  { playback: { kind: 'finished', outcome: 'unreachable', pathLength: 0, pathCost: null, exploredCount: 20 }, overlay: palette.failureVisitedOverlay },
  { playback: { kind: 'finished', outcome: 'cancelled', pathLength: 0, pathCost: null, exploredCount: 20 }, overlay: palette.cancelledOverlay },
])('uses translucent outcome overlays for visited and path cells ($playback)', ({ playback, overlay }) => {
  const view = terrainView(playback);
  const surface = new RecordingSurface({ width: 100, height: 100 });
  drawMaze(surface, { ...view, cells: view.cells.map((cell, node) => node === 0 ? { ...cell, layer: 'visited' } : cell) });
  expect(surface.calls.filter(call => call.color === overlay)).toHaveLength(6);
  const opaque = new Set<string>([palette.visited, palette.failureVisited, palette.cancelled]);
  expect(surface.calls.some(call => opaque.has(call.color))).toBe(false);
});

it('only clears a hidden terrain surface', () => {
  const surface = new RecordingSurface({ width: 0, height: 100 });
  drawMaze(surface, terrainView());
  expect(surface.calls).toEqual([{ method: 'clear', color: palette.background }]);
});
