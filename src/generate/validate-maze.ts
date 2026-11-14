import { checkPassageGrid } from './validation-checks.js';
import { openNeighbours, toNodeId, type NodeId, type WallMaze } from '../model/wall-maze.js';
import { err, ok, type Result } from '../primitives/result.js';

export interface MazeValidationError {
  readonly operation: 'validateWallMaze';
  readonly detail: string;
  readonly node?: NodeId;
}

/** Validate a generated perfect maze, including connectivity and tree edge count. */
export function validateWallMaze(maze: WallMaze): Result<void, MazeValidationError> {
  const fail = (detail: string, node?: NodeId): Result<never, MazeValidationError> =>
    err({ operation: 'validateWallMaze', detail, ...(node === undefined ? {} : { node }) });
  const issue = checkPassageGrid(maze);
  if (issue !== null) return fail(issue.detail, issue.node);
  const cells = maze.rows * maze.cols;
  let directedEdges = 0;
  for (let index = 0; index < cells; index += 1) {
    directedEdges += openNeighbours(maze, toNodeId(maze, index)).length;
  }
  if (directedEdges / 2 !== cells - 1) return fail('Edge count must equal cells minus one');
  return ok(undefined);
}
