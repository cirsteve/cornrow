import { cellOf, neighbours, nodeIdOf, type GridSize, type NodeId, type PassagePair } from '../model/wall-maze.js';
import type { Prng } from '../primitives/prng.js';

/** The backtracker draw order is part of generator version 1. */
export function carvePerfectMaze(grid: GridSize, prng: Prng): PassagePair[] {
  const start = nodeIdOf(grid, { row: 0, col: 0 });
  const stack: NodeId[] = [start];
  const visited = new Uint8Array(grid.rows * grid.cols);
  visited[start] = 1;
  const passages: PassagePair[] = [];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    if (current === undefined) break;
    const candidates = neighbours(grid, current).filter(node => visited[node] === 0);
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[prng.nextInt(candidates.length)];
    // The bound passed to nextInt is the non-empty candidate array length.
    if (next === undefined) throw new Error('Backtracker candidate invariant violated');
    passages.push([cellOf(grid, current), cellOf(grid, next)]);
    visited[next] = 1;
    stack.push(next);
  }
  return passages;
}
