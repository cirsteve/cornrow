import { expect, it } from 'vitest';
import { buildTerrainMaze } from './terrain-maze.js';
import { buildWallMaze, type EnvironmentId } from './wall-maze.js';

const options = { rows: 5, cols: 5, passages: [], costs: Array<number>(25).fill(1) };

it('builds and freezes terrain, retaining an explicit id and copying costs', () => {
  const costs = [...options.costs];
  const built = buildTerrainMaze({ ...options, costs, id: 'ridge' as EnvironmentId });
  if (!built.ok) throw new Error(built.error.detail);
  expect(built.value.kind).toBe('terrain');
  expect(built.value.id).toBe('ridge');
  expect(Object.isFrozen(built.value)).toBe(true);
  expect(Object.isFrozen(built.value.costs)).toBe(true);
  expect(Object.isFrozen(built.value.passages)).toBe(true);
  costs[0] = 8;
  expect(built.value.costs[0]).toBe(1);
});

it('checks costs against the clamped grid', () => {
  expect(buildTerrainMaze({ ...options, rows: 3 })).toMatchObject({ ok: true, value: { rows: 5 } });
  expect(buildTerrainMaze({ ...options, rows: 3, costs: Array<number>(15).fill(1) })).toMatchObject({
    ok: false, error: { operation: 'buildTerrainMaze', detail: expect.any(String) },
  });
});

it('identifies the node with an unsupported cost', () => {
  expect(buildTerrainMaze({ ...options, costs: [1, 3, ...options.costs.slice(2)] })).toMatchObject({
    ok: false, error: { operation: 'buildTerrainMaze', node: 1 },
  });
});

it('preserves wall builder errors before checking costs', () => {
  const invalid = { ...options, passages: [[{ row: 0, col: 0 }, { row: 4, col: 4 }]] as const, costs: [] };
  expect(buildTerrainMaze(invalid)).toEqual(buildWallMaze(invalid));
});

it('includes costs in the default identity', () => {
  const first = buildTerrainMaze(options);
  const second = buildTerrainMaze({ ...options, costs: [2, ...options.costs.slice(1)] });
  if (!first.ok || !second.ok) throw new Error('Invalid test terrain');
  expect(first.value.id).not.toBe(second.value.id);
});
