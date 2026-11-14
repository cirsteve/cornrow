import type { TerrainMaze } from './terrain-maze.js';
import type { NodeId, WallMaze } from './wall-maze.js';

export type Environment = WallMaze | TerrainMaze;

export function stepCost(environment: Environment, to: NodeId): number {
  if (environment.kind === 'wall-maze') return 1;
  const cost = environment.costs[to];
  // Constructed terrain has one cost per valid node; invalid access is a caller error.
  if (cost === undefined) throw new RangeError('stepCost: node outside terrain');
  return cost;
}

export function pathCost(environment: Environment, path: readonly NodeId[]): number {
  return path.slice(1).reduce((total, node) => total + stepCost(environment, node), 0);
}
