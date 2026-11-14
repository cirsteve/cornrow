import type { TerrainCost } from '../model/terrain-maze.js';

/** Rank ties by node id so equal noise is deterministic too. */
export function quantileBands(noise: ArrayLike<number>): TerrainCost[] {
  const ranked = Array.from({ length: noise.length }, (_, node) => node)
    .sort((first, second) => (noise[first] ?? 0) - (noise[second] ?? 0) || first - second);
  const costs = Array<TerrainCost>(noise.length);
  const first = Math.floor(0.4 * noise.length);
  const second = Math.floor(0.7 * noise.length);
  const third = Math.floor(0.9 * noise.length);
  ranked.forEach((node, rank) => { costs[node] = rank < first ? 1 : rank < second ? 2 : rank < third ? 4 : 8; });
  return costs;
}
