import { buildTerrainMaze } from '../model/terrain-maze.js';
import { clampGridSize, hasPassage, nodeIdOf, type EnvironmentId, type GeneratorId } from '../model/wall-maze.js';
import { createPrng, hashSeed } from '../primitives/prng.js';
import { carvePerfectMaze } from './carve.js';
import type { TerrainGenerator } from './contract.js';
import { quantileBands } from './quantile-bands.js';
import { valueNoise } from './value-noise.js';

export interface TerrainOptions {
  readonly seed: string | number;
  readonly rows: number;
  readonly cols: number;
  readonly openness?: number;
}

export const terrainGeneratorId = 'braided-value-noise' as GeneratorId;
export const terrainGeneratorVersion = '1';

export const braidedTerrain: TerrainGenerator = input => {
  const openness = input.openness ?? 0.5;
  const options = Object.freeze({
    seed: typeof input.seed === 'number' ? input.seed >>> 0 : input.seed,
    rows: clampGridSize(input.rows), cols: clampGridSize(input.cols),
    openness: Number.isFinite(openness) ? Math.max(0, Math.min(1, openness)) : 0.5,
  });
  const passages = carvePerfectMaze(options, createPrng(hashSeed(options.seed)));
  const base = buildTerrainMaze({ ...options, passages, costs: Array<number>(options.rows * options.cols).fill(1) });
  // The carve emits only in-grid adjacent pairs and has one cost per cell.
  if (!base.ok) throw new Error(`Terrain carve invariant: ${base.error.detail}`);
  const braid = createPrng(hashSeed(`${options.seed}/terrain-braid`));
  for (let row = 0; row < options.rows; row += 1) {
    for (let col = 0; col < options.cols; col += 1) {
      const from = { row, col };
      // Each interior edge is considered once, east before south, row-major.
      for (const to of [{ row, col: col + 1 }, { row: row + 1, col }]) {
        if (to.row >= options.rows || to.col >= options.cols) continue;
        if (hasPassage(base.value, nodeIdOf(options, from), nodeIdOf(options, to))) continue;
        if (braid.next() < options.openness) passages.push([from, to]);
      }
    }
  }
  const noise = valueNoise(options, createPrng(hashSeed(`${options.seed}/terrain-costs`)), { lattice: 4, octaves: 2 });
  const costs = quantileBands(noise);
  const id = `${terrainGeneratorId}/${terrainGeneratorVersion}/${encodeURIComponent(JSON.stringify(options))}` as EnvironmentId;
  const built = buildTerrainMaze({ ...options, passages, costs, id });
  // Braid pairs are adjacent in-grid cells, and quantile bands are valid costs.
  if (!built.ok) throw new Error(`Terrain construction invariant: ${built.error.detail}`);
  return Object.freeze({ environment: built.value, seed: options.seed, options,
    generatorId: terrainGeneratorId, generatorVersion: terrainGeneratorVersion });
};
