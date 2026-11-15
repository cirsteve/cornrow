import { expect, it } from 'vitest';
import { generate } from '../index.js';
import { checkPassageGrid } from '../generate/validation-checks.js';
import { addObstacles, removeObstacles, cellsInArea, setGoal } from './edit-environment.js';
import type { Result } from '../primitives/result.js';

function value<T>(result: Result<T, unknown>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}
const grid = { rows: 10, cols: 10 };
const center = { row: 4, col: 4 };
it('returns row-major clipped square areas', () => {
  expect(value(cellsInArea(grid, center, 0))).toEqual([center]);
  expect(value(cellsInArea(grid, center, 1))).toEqual([3, 4, 5].flatMap(row => [3, 4, 5].map(col => ({ row, col }))));
  expect(value(cellsInArea(grid, { row: 0, col: 0 }, 2))).toEqual([0, 1, 2].flatMap(row => [0, 1, 2].map(col => ({ row, col }))));
});
it.each([10, -1, 1.5])('rejects invalid center row %s', row => {
  expect(cellsInArea(grid, { row, col: 0 }, 0)).toMatchObject({ ok: false, error: { kind: 'outside-grid', operation: 'cellsInArea' } });
});
it.each([-1, 1.5, NaN, Infinity])('rejects invalid radius %s', radius => {
  expect(cellsInArea(grid, center, radius)).toMatchObject({ ok: false, error: { kind: 'invalid-radius' } });
});
it('closes incident walls, opens symmetric edges and preserves boundaries', () => {
  const env = generate({ seed: 'cornrow', ...grid }).environment;
  const added = value(addObstacles(env, center, 0));
  expect(added.passages[44]).toBe(0);
  for (const [node, bit] of [[34, 4], [45, 8], [54, 1], [43, 2]]) expect((added.passages[node ?? 0] ?? 0) & (bit ?? 0)).toBe(0);
  expect(value(removeObstacles(env, { row: 0, col: 0 }, 0)).passages[0]).toBe(6);
  for (const cell of [center, { row: 0, col: 0 }, { row: 9, col: 9 }]) {
    for (const radius of [0, 1, 5]) {
      for (const transform of [addObstacles, removeObstacles]) {
        const edited = value(transform(env, cell, radius));
        const issue = checkPassageGrid(edited);
        if (transform === removeObstacles) expect(issue).toBeNull();
        else if (issue !== null) expect(issue.detail).toBe('Not every cell is reachable from start');
        for (let row = 0; row < 10; row += 1) for (let col = 0; col < 10; col += 1) {
          const mask = edited.passages[row * 10 + col] ?? 0;
          if (row === 0) expect(mask & 1).toBe(0);
          if (col === 0) expect(mask & 8).toBe(0);
          if (row === 9) expect(mask & 4).toBe(0);
          if (col === 9) expect(mask & 2).toBe(0);
          if (col < 9) expect(Boolean(mask & 2)).toBe(Boolean((edited.passages[row * 10 + col + 1] ?? 0) & 8));
          if (row < 9) expect(Boolean(mask & 4)).toBe(Boolean((edited.passages[(row + 1) * 10 + col] ?? 0) & 1));
        }
      }
    }
  }
});
it('returns deterministic frozen copies without mutating inputs, including existing goals', () => {
  for (const kind of ['wall-maze', 'terrain'] as const) {
    const env = generate({ kind, seed: 'cornrow', ...grid }).environment;
    const before = JSON.stringify(env);
    for (const edited of [value(addObstacles(env, center, 1)), value(removeObstacles(env, center, 1)), value(setGoal(env, { row: 9, col: 9 }))]) {
      expect(Object.isFrozen(edited)).toBe(true);
      expect(Object.isFrozen(edited.passages)).toBe(true);
      expect(edited.id).toMatch(/^edited-/);
      expect(edited.id).not.toBe(env.id);
      if (edited.kind === 'terrain') expect(Object.isFrozen(edited.costs)).toBe(true);
    }
    expect(addObstacles(env, center, 1)).toEqual(addObstacles(env, center, 1));
    const goal = value(setGoal(env, { row: 3, col: 7 }));
    expect(goal.goal).toBe(37);
    expect(goal.start).toBe(env.start);
    expect(goal.passages).toEqual(env.passages);
    if (goal.kind === 'terrain' && env.kind === 'terrain') expect(goal.costs).toEqual(env.costs);
    expect(JSON.stringify(env)).toBe(before);
    expect(setGoal(env, { row: 0, col: 0 })).toMatchObject({ ok: false, error: { kind: 'start-cell' } });
    for (const transform of [addObstacles, removeObstacles, setGoal]) expect(transform(env, { row: 10, col: 0 }, 0)).toMatchObject({ ok: false, error: { operation: transform.name, kind: 'outside-grid' } });
  }
});
it('moves terrain costs one band with saturation and preserves passages', () => {
  const env = generate({ kind: 'terrain', seed: 'cornrow', ...grid }).environment;
  for (const [transform, delta] of [[addObstacles, 1], [removeObstacles, -1]] as const) {
    const edited = value(transform(env, center, 1));
    expect(edited.passages).toEqual(env.passages);
    for (let row = 0; row < 10; row += 1) for (let col = 0; col < 10; col += 1) {
      const i = row * 10 + col;
      const bands = [1, 2, 4, 8];
      expect(edited.costs[i]).toBe(Math.abs(row - 4) <= 1 && Math.abs(col - 4) <= 1
        ? bands[Math.max(0, Math.min(3, bands.indexOf(env.costs[i] ?? 1) + delta))] : env.costs[i]);
    }
    const all = value(transform(env, center, 20));
    expect(all.costs).toContain(delta === 1 ? 8 : 1);
  }
});
