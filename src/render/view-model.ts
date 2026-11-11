import type { NodeId } from '../model/wall-maze';

export const WALL_NORTH = 1;
export const WALL_EAST = 2;
export const WALL_SOUTH = 4;
export const WALL_WEST = 8;

export type PlaybackStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly solverLabel: string }
  | { readonly kind: 'paused'; readonly solverLabel: string }
  | { readonly kind: 'finished'; readonly outcome: 'found' | 'unreachable' | 'cancelled'; readonly pathLength: number; readonly exploredCount: number };

export interface CellView {
  readonly wallMask: number;
  readonly layer: 'empty' | 'frontier' | 'visited' | 'path';
}

export interface MazeViewModel {
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly CellView[];
  readonly start: NodeId;
  readonly goal: NodeId;
  readonly current: NodeId | null;
  readonly path: readonly NodeId[] | null;
  readonly playback: PlaybackStatus;
}
