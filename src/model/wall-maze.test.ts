import { describe, expect, it } from 'vitest';
import { buildWallMaze, cellOf, clampGridSize, hasPassage, neighbours, nodeIdOf, openNeighbours, toNodeId } from './wall-maze';
import { comparisonMaze, isolatedGoalMaze, openCorridorMaze } from './fixtures';

describe('wall-maze model', () => {
  it('round-trips row-major ids from a top-left origin', () => {
    for (let index = 0; index < 25; index += 1) {
      const id = toNodeId(comparisonMaze, index);
      expect(nodeIdOf(comparisonMaze, cellOf(comparisonMaze, id))).toBe(index);
    }
    expect(cellOf(comparisonMaze, toNodeId(comparisonMaze, 7))).toEqual({ row: 1, col: 2 });
    expect(() => toNodeId(comparisonMaze, 25)).toThrow(RangeError);
    expect(() => toNodeId(comparisonMaze, 0.5)).toThrow(RangeError);
    expect(() => nodeIdOf(comparisonMaze, { row: -1, col: 0 })).toThrow(RangeError);
  });

  it('orders in-grid neighbours north, east, south, west without row wrapping', () => {
    expect(neighbours(comparisonMaze, toNodeId(comparisonMaze, 6))).toEqual([1, 7, 11, 5]);
    expect(neighbours(comparisonMaze, comparisonMaze.start)).toEqual([1, 5]);
    expect(neighbours(comparisonMaze, toNodeId(comparisonMaze, 4))).toEqual([9, 3]);
    expect(openNeighbours(openCorridorMaze, openCorridorMaze.start)).toEqual([1]);
    expect(openNeighbours(isolatedGoalMaze, isolatedGoalMaze.goal)).toEqual([]);
  });

  it('builds symmetric masks and keeps non-passages closed', () => {
    expect(openCorridorMaze.passages[0]).toBe(2);
    expect(openCorridorMaze.passages[1]).toBe(10);
    for (let index = 0; index < 25; index += 1) {
      const node = toNodeId(openCorridorMaze, index);
      for (const other of neighbours(openCorridorMaze, node)) {
        expect(hasPassage(openCorridorMaze, node, other)).toBe(hasPassage(openCorridorMaze, other, node));
      }
    }
    expect(hasPassage(openCorridorMaze, openCorridorMaze.start, openCorridorMaze.goal)).toBe(false);
  });

  it('clamps every builder dimension and sets default endpoints', () => {
    expect([-10, 4, 5, 5.6, 80, 100, NaN, -Infinity, Infinity].map(clampGridSize))
      .toEqual([5, 5, 5, 6, 80, 80, 5, 5, 80]);
    const result = buildWallMaze({ rows: 2, cols: 100, passages: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([result.value.rows, result.value.cols, result.value.start, result.value.goal]).toEqual([5, 80, 0, 399]);
  });

  it('returns contextual errors for invalid pairs and endpoints', () => {
    for (const pair of [
      [{ row: 0, col: 0 }, { row: 2, col: 0 }],
      [{ row: 0, col: 4 }, { row: 1, col: 0 }],
      [{ row: -1, col: 0 }, { row: 0, col: 0 }],
      [{ row: 0, col: 0 }, { row: 0, col: 0 }],
    ] as const) {
      const result = buildWallMaze({ rows: 5, cols: 5, passages: [pair] });
      expect(result).toMatchObject({ ok: false, error: { operation: 'buildWallMaze', pair } });
    }
    expect(buildWallMaze({ rows: 5, cols: 5, passages: [], start: { row: 5, col: 0 } }).ok).toBe(false);
  });

  it('supports custom endpoints and freezes independent construction output', () => {
    const result = buildWallMaze({ rows: 5, cols: 5, passages: [], start: { row: 2, col: 1 }, goal: { row: 3, col: 4 } });
    if (!result.ok) throw new Error(result.error.detail);
    expect([result.value.start, result.value.goal]).toEqual([11, 19]);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.passages)).toBe(true);
    expect(() => { (result.value.passages as number[])[0] = 15; }).toThrow(TypeError);
  });
});

it('accepts a plain structural PassageGrid for passage queries', () => {
  const grid: import('./wall-maze.js').PassageGrid = { rows: 5, cols: 5, passages: [2, 8, ...Array<number>(23).fill(0)] };
  const first = toNodeId(grid, 0);
  const second = toNodeId(grid, 1);
  expect(hasPassage(grid, first, second)).toBe(true);
  expect(openNeighbours(grid, first)).toEqual([second]);
});
