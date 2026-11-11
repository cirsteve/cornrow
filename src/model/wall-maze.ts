import type { Brand } from '../primitives/brand.js';
import { hashSeed } from '../primitives/prng.js';
import { err, ok, type Result } from '../primitives/result.js';

export type NodeId = Brand<number, 'NodeId'>;
export type EnvironmentId = Brand<string, 'EnvironmentId'>;
export type GeneratorId = Brand<string, 'GeneratorId'>;
export type SolverId = Brand<string, 'SolverId'>;

export interface CellCoord {
  readonly row: number;
  readonly col: number;
}

export interface GridSize {
  readonly rows: number;
  readonly cols: number;
}

export interface WallMaze extends GridSize {
  readonly kind: 'wall-maze';
  readonly id: EnvironmentId;
  readonly start: NodeId;
  readonly goal: NodeId;
  readonly passages: ReadonlyArray<number>;
}

export type PassagePair = readonly [CellCoord, CellCoord];

export interface WallMazeBuildOptions extends GridSize {
  readonly passages: readonly PassagePair[];
  readonly start?: CellCoord;
  readonly goal?: CellCoord;
  readonly id?: EnvironmentId;
}

export interface MazeBuildError {
  readonly operation: 'buildWallMaze';
  readonly detail: string;
  readonly pair?: PassagePair;
  readonly coordinate?: CellCoord;
}

export function clampGridSize(size: number): number {
  if (Number.isNaN(size)) return 5;
  return Math.max(5, Math.min(80, Math.round(size)));
}

function isInGrid(grid: GridSize, cell: CellCoord): boolean {
  return Number.isInteger(cell.row) && Number.isInteger(cell.col)
    && cell.row >= 0 && cell.row < grid.rows && cell.col >= 0 && cell.col < grid.cols;
}

/** Invalid accessor arguments are programmer errors; use the builder for validation. */
export function nodeIdOf(grid: GridSize, cell: CellCoord): NodeId {
  if (!isInGrid(grid, cell)) throw new RangeError('nodeIdOf: coordinate outside grid');
  return (cell.row * grid.cols + cell.col) as NodeId;
}

export function toNodeId(grid: GridSize, value: number): NodeId {
  if (!Number.isInteger(value) || value < 0 || value >= grid.rows * grid.cols) {
    throw new RangeError('toNodeId: index outside grid');
  }
  return value as NodeId;
}

export function cellOf(grid: GridSize, node: NodeId): CellCoord {
  toNodeId(grid, node);
  return { row: Math.floor(node / grid.cols), col: node % grid.cols };
}

export function neighbours(grid: GridSize, node: NodeId): readonly NodeId[] {
  const { row, col } = cellOf(grid, node);
  const cells = [
    { row: row - 1, col }, { row, col: col + 1 },
    { row: row + 1, col }, { row, col: col - 1 },
  ];
  return cells.filter(cell => isInGrid(grid, cell)).map(cell => nodeIdOf(grid, cell));
}

function passageBit(grid: GridSize, from: NodeId, to: NodeId): number {
  const first = cellOf(grid, from);
  const second = cellOf(grid, to);
  if (first.col === second.col && second.row === first.row - 1) return 1;
  if (first.row === second.row && second.col === first.col + 1) return 2;
  if (first.col === second.col && second.row === first.row + 1) return 4;
  if (first.row === second.row && second.col === first.col - 1) return 8;
  return 0;
}

export function hasPassage(maze: WallMaze, from: NodeId, to: NodeId): boolean {
  const bit = passageBit(maze, from, to);
  return bit !== 0 && ((maze.passages[from] ?? 0) & bit) !== 0;
}

export function openNeighbours(maze: WallMaze, node: NodeId): readonly NodeId[] {
  return neighbours(maze, node).filter(other => hasPassage(maze, node, other));
}

export function buildWallMaze(options: WallMazeBuildOptions): Result<WallMaze, MazeBuildError> {
  const grid = { rows: clampGridSize(options.rows), cols: clampGridSize(options.cols) };
  const start = options.start ?? { row: 0, col: 0 };
  const goal = options.goal ?? { row: grid.rows - 1, col: grid.cols - 1 };
  for (const coordinate of [start, goal]) {
    if (!isInGrid(grid, coordinate)) {
      return err({ operation: 'buildWallMaze', detail: 'Endpoint outside normalized grid', coordinate });
    }
  }
  const passages = Array<number>(grid.rows * grid.cols).fill(0);
  for (const pair of options.passages) {
    const [first, second] = pair;
    if (!isInGrid(grid, first) || !isInGrid(grid, second)) {
      return err({ operation: 'buildWallMaze', detail: 'Passage outside normalized grid', pair });
    }
    const from = nodeIdOf(grid, first);
    const to = nodeIdOf(grid, second);
    const forward = passageBit(grid, from, to);
    if (forward === 0) {
      return err({ operation: 'buildWallMaze', detail: 'Passage cells must be adjacent', pair });
    }
    passages[from] = (passages[from] ?? 0) | forward;
    passages[to] = (passages[to] ?? 0) | passageBit(grid, to, from);
  }
  const startId = nodeIdOf(grid, start);
  const goalId = nodeIdOf(grid, goal);
  const id = options.id ?? `fixture-${hashSeed(JSON.stringify([grid, startId, goalId, passages]))}` as EnvironmentId;
  return ok(Object.freeze({
    kind: 'wall-maze', id, ...grid, start: startId, goal: goalId,
    passages: Object.freeze(passages),
  }));
}
