import { carvePerfectMaze } from './carve.js';
import { buildWallMaze, clampGridSize, type EnvironmentId, type GeneratorId } from '../model/wall-maze.js';
import { createPrng, hashSeed } from '../primitives/prng.js';
import type { WallMazeGenerator } from './contract.js';

export const generatorId = 'recursive-backtracker' as GeneratorId;
export const generatorVersion = '1';

export const recursiveBacktracker: WallMazeGenerator = input => {
  const options = Object.freeze({
    seed: typeof input.seed === 'number' ? input.seed >>> 0 : input.seed,
    rows: clampGridSize(input.rows),
    cols: clampGridSize(input.cols),
  });
  const random = createPrng(hashSeed(options.seed));
  const passages = carvePerfectMaze(options, random);
  const id = `${generatorId}/${generatorVersion}/${encodeURIComponent(JSON.stringify(options))}` as EnvironmentId;
  const built = buildWallMaze({ ...options, passages, id });
  // All pairs were obtained from in-grid neighbours, so construction cannot fail.
  if (!built.ok) throw new Error(`Backtracker construction invariant: ${built.error.detail}`);
  return Object.freeze({ environment: built.value, seed: options.seed, options, generatorId, generatorVersion });
};
