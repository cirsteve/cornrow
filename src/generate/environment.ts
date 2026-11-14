import type { EnvironmentOptions, GenerationResult, WallMazeOptions } from './contract.js';
import type { Environment } from '../model/environment.js';
import { recursiveBacktracker } from './recursive-backtracker.js';
import { braidedTerrain, type TerrainOptions } from './terrain.js';

export function generateEnvironment(options: EnvironmentOptions): GenerationResult<Environment, WallMazeOptions | Required<TerrainOptions>> {
  switch (options.kind) {
    case 'terrain': return braidedTerrain(options);
    default: return recursiveBacktracker(options);
  }
}
