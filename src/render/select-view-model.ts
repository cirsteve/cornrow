import type { NodeId } from '../model/wall-maze.js';
import type { Environment } from '../model/environment.js';
import { TERRAIN_COSTS, type TerrainCost } from '../model/terrain-maze.js';
import type { TraceState } from '../trace/trace-state.js';
import { WALL_NORTH, WALL_EAST, WALL_SOUTH, WALL_WEST } from './view-model.js';
import type { CellView, MazeViewModel, PlaybackStatus } from './view-model.js';

export function terrainCostBand(cost: TerrainCost): 0 | 1 | 2 | 3 {
  // TerrainCost is exactly the four entries in TERRAIN_COSTS.
  return TERRAIN_COSTS.indexOf(cost) as 0 | 1 | 2 | 3;
}

export function selectViewModel(maze: Environment, trace: TraceState, playback: PlaybackStatus): MazeViewModel {
  const path = new Set(trace.path ?? []);
  const cells = maze.passages.map((passages, index): CellView => {
    const node = index as NodeId; // Passage indices are model node ids.
    const row = Math.floor(index / maze.cols);
    const col = index % maze.cols;
    const boundary = (row === 0 ? WALL_NORTH : 0) | (col === maze.cols - 1 ? WALL_EAST : 0)
      | (row === maze.rows - 1 ? WALL_SOUTH : 0) | (col === 0 ? WALL_WEST : 0);
    return {
      costBand: maze.kind === 'terrain' ? terrainCostBand(maze.costs[index] as TerrainCost) : null,
      wallMask: ((~passages) & 15) | boundary,
      layer: path.has(node) ? 'path' : trace.visited.has(node) ? 'visited' : trace.frontier.has(node) ? 'frontier' : 'empty',
    };
  });
  return { environment: maze.kind, rows: maze.rows, cols: maze.cols, cells, start: maze.start, goal: maze.goal, current: trace.current, path: trace.path, playback };
}
