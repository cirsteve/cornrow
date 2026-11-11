import type { NodeId, WallMaze } from '../model/wall-maze';
import type { TraceState } from '../trace/trace-state';
import { WALL_NORTH, WALL_EAST, WALL_SOUTH, WALL_WEST } from './view-model';
import type { CellView, MazeViewModel, PlaybackStatus } from './view-model';

export function selectViewModel(maze: WallMaze, trace: TraceState, playback: PlaybackStatus): MazeViewModel {
  const path = new Set(trace.path ?? []);
  const cells = maze.passages.map((passages, index): CellView => {
    const node = index as NodeId; // Passage indices are model node ids.
    const row = Math.floor(index / maze.cols);
    const col = index % maze.cols;
    const boundary = (row === 0 ? WALL_NORTH : 0) | (col === maze.cols - 1 ? WALL_EAST : 0)
      | (row === maze.rows - 1 ? WALL_SOUTH : 0) | (col === 0 ? WALL_WEST : 0);
    return {
      wallMask: ((~passages) & 15) | boundary,
      layer: path.has(node) ? 'path' : trace.visited.has(node) ? 'visited' : trace.frontier.has(node) ? 'frontier' : 'empty',
    };
  });
  return { rows: maze.rows, cols: maze.cols, cells, start: maze.start, goal: maze.goal, current: trace.current, path: trace.path, playback };
}
