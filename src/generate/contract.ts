import type { TerrainMaze } from '../model/terrain-maze.js';
import type { TerrainOptions } from './terrain.js';
import type { GeneratorId, WallMaze } from '../model/wall-maze.js';

export interface WallMazeOptions {
  readonly seed: string | number;
  readonly rows: number;
  readonly cols: number;
}

export interface GenerationResult<TEnvironment, Options> {
  readonly environment: TEnvironment;
  readonly seed: string | number;
  readonly options: Readonly<Options>;
  readonly generatorId: GeneratorId;
  readonly generatorVersion: string;
}

export type WallMazeGenerator = (options: WallMazeOptions) => GenerationResult<WallMaze, WallMazeOptions>;

export type TerrainGenerator = (options: TerrainOptions) => GenerationResult<TerrainMaze, Required<TerrainOptions>>;
export type EnvironmentOptions = ({ readonly kind?: 'wall-maze' } & WallMazeOptions)
  | ({ readonly kind: 'terrain' } & TerrainOptions);
