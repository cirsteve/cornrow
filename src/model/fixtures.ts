import { buildTerrainMaze } from './terrain-maze.js';
import { buildWallMaze, type PassagePair, type WallMaze } from './wall-maze.js';

function fixture(passages: readonly PassagePair[]): WallMaze {
  const result = buildWallMaze({ rows: 5, cols: 5, passages });
  if (!result.ok) throw new Error(`Invalid built-in fixture: ${result.error.detail}`);
  return result.value;
}

const corridorPassages: PassagePair[] = [];
for (let col = 0; col < 4; col += 1) {
  corridorPassages.push([{ row: 0, col }, { row: 0, col: col + 1 }]);
}
for (let row = 0; row < 4; row += 1) {
  corridorPassages.push([{ row, col: 4 }, { row: row + 1, col: 4 }]);
}

export const openCorridorMaze = fixture(corridorPassages);
export const isolatedGoalMaze = fixture(corridorPassages.slice(0, -1));

// A fully open 5x5 grid: shortest corner-to-corner paths have eight edges.
// BFS expands breadth-wise; Manhattan A* follows the east/south boundary.
const comparisonPassages: PassagePair[] = [];
for (let row = 0; row < 5; row += 1) {
  for (let col = 0; col < 5; col += 1) {
    if (col < 4) comparisonPassages.push([{ row, col }, { row, col: col + 1 }]);
    if (row < 4) comparisonPassages.push([{ row, col }, { row: row + 1, col }]);
  }
}
export const comparisonMaze = fixture(comparisonPassages);

const ridgeBuilt = buildTerrainMaze({
  rows: 5, cols: 5, passages: comparisonPassages,
  start: { row: 2, col: 0 }, goal: { row: 2, col: 4 },
  costs: Array.from({ length: 25 }, (_, node) => node < 20 && node % 5 === 2 ? 8 : 1),
});
if (!ridgeBuilt.ok) throw new Error(`Invalid ridge fixture: ${ridgeBuilt.error.detail}`);
export const ridgeTerrain = ridgeBuilt.value;
