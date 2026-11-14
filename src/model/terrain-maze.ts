import { hashSeed } from '../primitives/prng.js';
import { err, ok, type Result } from '../primitives/result.js';
import { buildWallMaze, toNodeId, type EnvironmentId, type GridSize, type MazeBuildError, type NodeId, type WallMazeBuildOptions } from './wall-maze.js';

export const TERRAIN_COSTS = [1, 2, 4, 8] as const;
export type TerrainCost = (typeof TERRAIN_COSTS)[number];

export interface TerrainMaze extends GridSize {
  readonly kind: 'terrain';
  readonly id: EnvironmentId;
  readonly start: NodeId;
  readonly goal: NodeId;
  readonly passages: ReadonlyArray<number>;
  readonly costs: ReadonlyArray<TerrainCost>;
}

export interface TerrainMazeBuildOptions extends WallMazeBuildOptions {
  readonly costs: readonly number[];
}

export interface TerrainBuildError {
  readonly operation: 'buildTerrainMaze';
  readonly detail: string;
  readonly node?: NodeId;
}

export function buildTerrainMaze(options: TerrainMazeBuildOptions): Result<TerrainMaze, MazeBuildError | TerrainBuildError> {
  const built = buildWallMaze(options);
  if (!built.ok) return built;
  const maze = built.value;
  if (options.costs.length !== maze.rows * maze.cols) {
    return err({ operation: 'buildTerrainMaze', detail: 'Cost array length must equal normalized grid size' });
  }
  const costs: TerrainCost[] = [];
  for (let index = 0; index < options.costs.length; index += 1) {
    const cost = options.costs[index];
    if (cost !== 1 && cost !== 2 && cost !== 4 && cost !== 8) {
      return err({ operation: 'buildTerrainMaze', detail: 'Cost must be one of 1, 2, 4, 8', node: toNodeId(maze, index) });
    }
    costs.push(cost);
  }
  const grid = { rows: maze.rows, cols: maze.cols };
  const id = options.id ?? `terrain-fixture-${hashSeed(JSON.stringify(['terrain', grid, maze.start, maze.goal, maze.passages, costs]))}` as EnvironmentId;
  return ok(Object.freeze({ ...maze, kind: 'terrain', id, costs: Object.freeze(costs) }));
}
