import type { GeneratorId, WallMaze } from '../model/wall-maze';

export interface WallMazeOptions {
  readonly seed: string | number;
  readonly rows: number;
  readonly cols: number;
}

export interface GenerationResult<Environment, Options> {
  readonly environment: Environment;
  readonly seed: string | number;
  readonly options: Readonly<Options>;
  readonly generatorId: GeneratorId;
  readonly generatorVersion: string;
}

export type WallMazeGenerator = (options: WallMazeOptions) => GenerationResult<WallMaze, WallMazeOptions>;
