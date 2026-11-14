import { TERRAIN_COSTS, type TerrainMaze } from '../model/terrain-maze.js';
import { toNodeId, type NodeId } from '../model/wall-maze.js';
import { err, ok, type Result } from '../primitives/result.js';
import { checkPassageGrid } from './validation-checks.js';

export interface TerrainValidationError {
  readonly operation: 'validateTerrainMaze';
  readonly detail: string;
  readonly node?: NodeId;
}

export function validateTerrainMaze(maze: TerrainMaze): Result<void, TerrainValidationError> {
  const issue = checkPassageGrid(maze);
  if (issue !== null) return err({ operation: 'validateTerrainMaze', ...issue });
  if (maze.costs.length !== maze.rows * maze.cols) {
    return err({ operation: 'validateTerrainMaze', detail: 'Cost array length must equal grid size' });
  }
  for (let index = 0; index < maze.costs.length; index += 1) {
    const cost = maze.costs[index];
    if (cost === undefined || !TERRAIN_COSTS.includes(cost)) {
      return err({ operation: 'validateTerrainMaze', detail: 'Invalid terrain cost', node: toNodeId(maze, index) });
    }
  }
  return ok(undefined);
}
