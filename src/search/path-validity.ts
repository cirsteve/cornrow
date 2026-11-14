import { hasPassage, toNodeId, type NodeId, type PassageGrid } from '../model/wall-maze.js';
import { err, ok, type Result } from '../primitives/result.js';
import type { Endpoints } from './contract.js';

export interface PathValidityError {
  readonly operation: 'checkPath';
  readonly detail: string;
  readonly index?: number;
}

export function checkPath(maze: PassageGrid, path: readonly NodeId[], endpoints: Endpoints): Result<void, PathValidityError> {
  if (path.length === 0) return err({ operation: 'checkPath', detail: 'Path is empty' });
  if (path[0] !== endpoints.start || path[path.length - 1] !== endpoints.goal) {
    return err({ operation: 'checkPath', detail: 'Path endpoints do not match requested endpoints' });
  }
  for (let index = 0; index < path.length; index += 1) {
    const node = path[index];
    if (node === undefined || !Number.isInteger(node) || node < 0 || node >= maze.rows * maze.cols) {
      return err({ operation: 'checkPath', detail: 'Path node is outside grid', index });
    }
  }
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous === undefined || current === undefined || !hasPassage(maze, previous, current)) {
      return err({ operation: 'checkPath', detail: 'Path crosses a wall', index });
    }
  }
  return ok(undefined);
}

/** Reconstruct a discovered route; parent links are internal solver invariants. */
export function reconstructPath(maze: PassageGrid, parents: Int32Array, endpoints: Endpoints): readonly NodeId[] {
  const path = [endpoints.goal];
  let current = endpoints.goal;
  while (current !== endpoints.start) {
    const parent = parents[current];
    if (parent === undefined || parent < 0 || path.length > parents.length) {
      throw new Error('reconstructPath: invalid parent chain');
    }
    current = toNodeId(maze, parent);
    path.push(current);
  }
  return Object.freeze(path.reverse());
}
