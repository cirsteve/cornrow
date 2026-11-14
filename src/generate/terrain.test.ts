import { expect, it } from 'vitest';
import { hasPassage, neighbours, nodeIdOf, openNeighbours, toNodeId, type PassageGrid } from '../model/wall-maze.js';
import { recursiveBacktracker } from './recursive-backtracker.js';
import { braidedTerrain, terrainGeneratorVersion } from './terrain.js';
import { validateTerrainMaze } from './validate-terrain.js';

const sample = { seed: 'cornrow', rows: 10, cols: 10 };

function renderAscii(maze: PassageGrid): string {
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

it('replays topology, costs and provenance from normalized options', () => {
  const generated = braidedTerrain(sample);
  expect(braidedTerrain(sample)).toEqual(generated);
  expect(generated.options).toEqual({ ...sample, openness: 0.5 });
  expect(generated.environment.id).toContain('braided-value-noise/1/');
  expect(generated.generatorVersion).toBe(terrainGeneratorVersion);
  expect(validateTerrainMaze(generated.environment).ok).toBe(true);
  expect(Object.isFrozen(generated)).toBe(true);
  expect(Object.isFrozen(generated.options)).toBe(true);
});

it('keeps cost streams independent of openness', () => {
  const lower = braidedTerrain({ ...sample, openness: 0.3 }).environment;
  const higher = braidedTerrain({ ...sample, openness: 0.7 }).environment;
  expect(lower.costs).toEqual(higher.costs);
  expect(lower.passages).not.toEqual(higher.passages);
});

it('preserves the perfect carve at zero and opens every interior wall at one', () => {
  expect(braidedTerrain({ ...sample, openness: 0 }).environment.passages).toEqual(recursiveBacktracker(sample).environment.passages);
  const open = braidedTerrain({ ...sample, openness: 1 }).environment;
  for (let index = 0; index < 100; index += 1) {
    const node = toNodeId(open, index);
    expect(openNeighbours(open, node)).toEqual(neighbours(open, node));
  }
});

it.each([NaN, Infinity, -Infinity])('normalizes nonfinite openness %s to one half', openness => {
  expect(braidedTerrain({ ...sample, openness })).toEqual(braidedTerrain({ ...sample, openness: 0.5 }));
});

it('clamps openness and dimensions and normalizes numeric seeds before stream derivation', () => {
  expect(braidedTerrain({ ...sample, openness: -1 })).toEqual(braidedTerrain({ ...sample, openness: 0 }));
  expect(braidedTerrain({ ...sample, openness: 2 })).toEqual(braidedTerrain({ ...sample, openness: 1 }));
  expect(braidedTerrain({ ...sample, seed: 2 ** 32 + 5 })).toEqual(braidedTerrain({ ...sample, seed: 5 }));
  expect(braidedTerrain({ seed: 5, rows: 3, cols: 90 }).options).toEqual({ seed: 5, rows: 5, cols: 80, openness: 0.5 });
});

it('pins cornrow 10x10 terrain topology and costs (version 1, openness 0.5)', () => {
  const maze = braidedTerrain({ ...sample, openness: 0.5 }).environment;
  expect(renderAscii(maze)).toBe(`+---+---+---+---+---+---+---+---+---+---+
|   |       |                           |
+   +   +   +   +   +   +---+   +   +   +
|   |       |                   |       |
+   +   +   +   +   +---+---+   +   +   +
|   |   |   |   |                       |
+   +   +   +   +   +   +   +   +---+   +
|       |                               |
+   +   +---+---+---+   +---+   +   +   +
|       |                       |       |
+   +---+   +   +   +   +   +   +   +   +
|           |                       |   |
+   +   +   +   +   +   +   +   +   +   +
|       |   |               |           |
+   +   +   +   +   +---+   +   +   +   +
|   |       |                           |
+   +   +   +   +   +   +   +   +---+   +
|   |           |       |               |
+   +   +---+   +---+---+   +   +---+   +
|                               |       |
+---+---+---+---+---+---+---+---+---+---+`);
  const costs = Array.from({ length: 10 }, (_, row) => maze.costs.slice(row * 10, row * 10 + 10).join('')).join('\n');
  expect(costs).toBe(`1114888888
1114888444
1114842112
1114442111
1114442111
1122442111
2222221112
2211112222
4211122222
1122224444`);
});
