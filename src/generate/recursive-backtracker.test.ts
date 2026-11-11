import { describe, expect, it, vi } from 'vitest';
import { cellOf, hasPassage, nodeIdOf, type WallMaze } from '../model/wall-maze';
import { comparisonMaze, isolatedGoalMaze } from '../model/fixtures';
import { recursiveBacktracker } from './recursive-backtracker';
import { validateWallMaze } from './validate-maze';

function renderAscii(maze: WallMaze): string {
  const lines = ['+' + '---+'.repeat(maze.cols)];
  for (let row = 0; row < maze.rows; row += 1) {
    let middle = '|';
    let bottom = '+';
    for (let col = 0; col < maze.cols; col += 1) {
      const node = nodeIdOf(maze, { row, col });
      const east = col < maze.cols - 1 && hasPassage(maze, node, nodeIdOf(maze, { row, col: col + 1 }));
      const south = row < maze.rows - 1 && hasPassage(maze, node, nodeIdOf(maze, { row: row + 1, col }));
      middle += '   ' + (east ? ' ' : '|');
      bottom += (south ? '   ' : '---') + '+';
    }
    lines.push(middle, bottom);
  }
  return lines.join('\n');
}

describe('recursive backtracker', () => {
  const sample = { seed: 'cornrow', rows: 10, cols: 10 };

  it('replays topology and provenance and changes topology with a different seed', () => {
    const first = recursiveBacktracker(sample);
    expect(recursiveBacktracker(sample)).toEqual(first);
    const different = recursiveBacktracker({ ...sample, seed: 'maize' });
    expect(different.environment.passages).not.toEqual(first.environment.passages);
    expect(different.environment.id).not.toBe(first.environment.id);
    expect(first).toMatchObject({ seed: 'cornrow', options: sample, generatorId: 'recursive-backtracker', generatorVersion: '1' });
  });

  it('uses local seeded randomness without touching Math.random or DOM globals', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Global randomness used'); });
    try {
      expect(validateWallMaze(recursiveBacktracker(sample).environment).ok).toBe(true);
      expect(typeof window).toBe('undefined');
      expect(typeof document).toBe('undefined');
    } finally {
      random.mockRestore();
    }
  });

  it.each([
    { seed: 0, rows: 5, cols: 5 },
    { seed: -1, rows: 1, cols: 8.6 },
    { seed: 'largest', rows: 100, cols: 80 },
    { seed: 'rectangle', rows: 7, cols: 12 },
  ])('generates a connected symmetric spanning tree for %j', options => {
    const result = recursiveBacktracker(options);
    expect(validateWallMaze(result.environment)).toEqual({ ok: true, value: undefined });
    expect(result.environment.rows).toBe(result.options.rows);
    expect(result.environment.cols).toBe(result.options.cols);
    expect(cellOf(result.environment, result.environment.goal)).toEqual({ row: result.options.rows - 1, col: result.options.cols - 1 });
    expect(Object.isFrozen(result.environment.passages)).toBe(true);
  });

  it('rejects corrupt boundaries, asymmetry, masks, disconnected cells and cycles', () => {
    const maze = recursiveBacktracker(sample).environment;
    const boundaries = [...maze.passages];
    boundaries[0] = (boundaries[0] ?? 0) | 1;
    expect(validateWallMaze({ ...maze, passages: boundaries })).toMatchObject({ ok: false, error: { detail: 'Passage leaves grid' } });
    const asymmetric = [...maze.passages];
    asymmetric[0] = (asymmetric[0] ?? 0) ^ 2;
    expect(validateWallMaze({ ...maze, passages: asymmetric })).toMatchObject({ ok: false, error: { detail: 'Asymmetric passage' } });
    expect(validateWallMaze({ ...maze, passages: [-1, ...maze.passages.slice(1)] }).ok).toBe(false);
    expect(validateWallMaze({ ...maze, passages: [] }).ok).toBe(false);
    expect(validateWallMaze(isolatedGoalMaze)).toMatchObject({ ok: false, error: { detail: 'Not every cell is reachable from start' } });
    expect(validateWallMaze(comparisonMaze)).toMatchObject({ ok: false, error: { detail: 'Edge count must equal cells minus one' } });
  });

  it('pins cornrow at 10x10 (version 1)', () => {
    expect(renderAscii(recursiveBacktracker(sample).environment)).toBe(`+---+---+---+---+---+---+---+---+---+---+
|   |       |               |           |
+   +   +   +   +---+---+---+   +   +   +
|   |   |   |                   |   |   |
+   +   +   +   +---+---+---+   +   +---+
|   |   |   |   |           |   |       |
+   +   +   +---+   +---+   +   +---+   +
|   |   |           |       |   |       |
+   +   +---+---+---+   +---+---+   +---+
|       |           |           |       |
+---+---+   +---+   +---+---+   +   +   +
|           |   |   |       |   |   |   |
+---+---+   +   +   +---+   +   +---+   +
|       |   |               |   |       |
+   +   +   +---+---+---+---+   +   +---+
|   |   |   |       |           |       |
+   +   +   +   +   +   +---+---+---+   +
|   |       |   |       |               |
+   +---+---+   +---+---+---+   +---+   +
|                               |       |
+---+---+---+---+---+---+---+---+---+---+`);
  });
});
