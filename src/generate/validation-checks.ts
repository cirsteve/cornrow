import { cellOf, clampGridSize, hasPassage, neighbours, openNeighbours, toNodeId, type NodeId, type PassageGrid } from '../model/wall-maze.js';

export interface PassageValidationIssue {
  readonly detail: string;
  readonly node?: NodeId;
}

interface ValidationGrid extends PassageGrid {
  readonly start: NodeId;
  readonly goal: NodeId;
}

/** Shared bounds, symmetry and connectivity checks, in wall-validator order. */
export function checkPassageGrid(maze: ValidationGrid): PassageValidationIssue | null {
  const issue = (detail: string, node?: NodeId): PassageValidationIssue =>
    ({ detail, ...(node === undefined ? {} : { node }) });
  const cells = maze.rows * maze.cols;
  if (maze.rows !== clampGridSize(maze.rows) || maze.cols !== clampGridSize(maze.cols)
    || maze.passages.length !== cells) return issue('Invalid dimensions or passage array length');
  if (![maze.start, maze.goal].every(node => Number.isInteger(node) && node >= 0 && node < cells)) {
    return issue('Endpoint outside grid');
  }
  for (let index = 0; index < cells; index += 1) {
    const node = toNodeId(maze, index);
    const mask = maze.passages[node];
    if (mask === undefined || !Number.isInteger(mask) || mask < 0 || mask > 15) return issue('Invalid passage mask', node);
    const { row, col } = cellOf(maze, node);
    if ((row === 0 && (mask & 1)) || (col === maze.cols - 1 && (mask & 2))
      || (row === maze.rows - 1 && (mask & 4)) || (col === 0 && (mask & 8))) {
      return issue('Passage leaves grid', node);
    }
    for (const other of neighbours(maze, node)) {
      if (hasPassage(maze, node, other) !== hasPassage(maze, other, node)) return issue('Asymmetric passage', node);
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
  if (reached.size !== cells) return issue('Not every cell is reachable from start');
  return null;
}
