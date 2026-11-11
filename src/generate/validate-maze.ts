import { cellOf, clampGridSize, hasPassage, neighbours, openNeighbours, toNodeId, type NodeId, type WallMaze } from '../model/wall-maze';
import { err, ok, type Result } from '../primitives/result';

export interface MazeValidationError {
  readonly operation: 'validateWallMaze';
  readonly detail: string;
  readonly node?: NodeId;
}

/** Validate a generated perfect maze, including connectivity and tree edge count. */
export function validateWallMaze(maze: WallMaze): Result<void, MazeValidationError> {
  const fail = (detail: string, node?: NodeId): Result<never, MazeValidationError> =>
    err({ operation: 'validateWallMaze', detail, ...(node === undefined ? {} : { node }) });
  const cells = maze.rows * maze.cols;
  if (maze.rows !== clampGridSize(maze.rows) || maze.cols !== clampGridSize(maze.cols)
    || maze.passages.length !== cells) return fail('Invalid dimensions or passage array length');
  if (![maze.start, maze.goal].every(node => Number.isInteger(node) && node >= 0 && node < cells)) {
    return fail('Endpoint outside grid');
  }
  let directedEdges = 0;
  for (let index = 0; index < cells; index += 1) {
    const node = toNodeId(maze, index);
    const mask = maze.passages[node];
    if (mask === undefined || !Number.isInteger(mask) || mask < 0 || mask > 15) return fail('Invalid passage mask', node);
    const { row, col } = cellOf(maze, node);
    if ((row === 0 && (mask & 1)) || (col === maze.cols - 1 && (mask & 2))
      || (row === maze.rows - 1 && (mask & 4)) || (col === 0 && (mask & 8))) {
      return fail('Passage leaves grid', node);
    }
    for (const other of neighbours(maze, node)) {
      if (hasPassage(maze, node, other) !== hasPassage(maze, other, node)) return fail('Asymmetric passage', node);
      if (hasPassage(maze, node, other)) directedEdges += 1;
    }
  }
  const reached = new Set<NodeId>([maze.start]);
  const queue = [maze.start];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (current === undefined) break;
    for (const other of openNeighbours(maze, current)) {
      if (reached.has(other)) continue;
      reached.add(other);
      queue.push(other);
    }
  }
  if (reached.size !== cells) return fail('Not every cell is reachable from start');
  if (directedEdges / 2 !== cells - 1) return fail('Edge count must equal cells minus one');
  return ok(undefined);
}
