import { expect, it } from 'vitest';
import type { TerrainCost } from '../model/terrain-maze.js';
import { ridgeTerrain } from '../model/fixtures.js';
import { braidedTerrain } from './terrain.js';
import { validateTerrainMaze } from './validate-terrain.js';

it('accepts connected terrain with cycles', () => {
  expect(validateTerrainMaze(braidedTerrain({ seed: 'cornrow', rows: 10, cols: 10 }).environment)).toEqual({ ok: true, value: undefined });
  expect(validateTerrainMaze(ridgeTerrain).ok).toBe(true);
});

it('reports asymmetric passages with the terrain operation and node', () => {
  const passages = [...ridgeTerrain.passages];
  passages[0] = 4;
  expect(validateTerrainMaze({ ...ridgeTerrain, passages })).toMatchObject({ ok: false,
    error: { operation: 'validateTerrainMaze', detail: 'Asymmetric passage', node: 0 } });
});

it('rejects a disconnected cell', () => {
  const passages = [...ridgeTerrain.passages];
  passages[0] = 0;
  passages[1] = (passages[1] ?? 0) & ~8;
  passages[5] = (passages[5] ?? 0) & ~1;
  expect(validateTerrainMaze({ ...ridgeTerrain, passages })).toMatchObject({ ok: false,
    error: { operation: 'validateTerrainMaze', detail: 'Not every cell is reachable from start' } });
});

it('rejects invalid cost lengths and values', () => {
  expect(validateTerrainMaze({ ...ridgeTerrain, costs: [] })).toMatchObject({ ok: false,
    error: { operation: 'validateTerrainMaze', detail: expect.any(String) } });
  expect(validateTerrainMaze({ ...ridgeTerrain, costs: [3 as TerrainCost, ...ridgeTerrain.costs.slice(1)] })).toMatchObject({ ok: false,
    error: { operation: 'validateTerrainMaze', detail: 'Invalid terrain cost', node: 0 } });
});

it('shares bounds, mask and endpoint guards', () => {
  for (const invalid of [
    { ...ridgeTerrain, rows: 3 }, { ...ridgeTerrain, passages: [] },
    { ...ridgeTerrain, start: 25 as typeof ridgeTerrain.start },
    { ...ridgeTerrain, passages: [16, ...ridgeTerrain.passages.slice(1)] },
    { ...ridgeTerrain, passages: [7, ...ridgeTerrain.passages.slice(1)] },
  ]) {
    expect(validateTerrainMaze(invalid)).toMatchObject({ ok: false, error: { operation: 'validateTerrainMaze', detail: expect.any(String) } });
  }
});
