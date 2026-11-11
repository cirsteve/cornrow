import { buildWallMaze, cellOf, clampGridSize, neighbours, nodeIdOf, type EnvironmentId, type GeneratorId, type NodeId, type PassagePair } from '../model/wall-maze.js';
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
  const start = nodeIdOf(options, { row: 0, col: 0 });
  const stack: NodeId[] = [start];
  const visited = new Uint8Array(options.rows * options.cols);
  visited[start] = 1;
  const passages: PassagePair[] = [];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    if (current === undefined) break;
    const candidates = neighbours(options, current).filter(node => visited[node] === 0);
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[random.nextInt(candidates.length)];
    // The bound passed to nextInt is the non-empty candidate array length.
    if (next === undefined) throw new Error('Backtracker candidate invariant violated');
    passages.push([cellOf(options, current), cellOf(options, next)]);
    visited[next] = 1;
    stack.push(next);
  }
  const id = `${generatorId}/${generatorVersion}/${encodeURIComponent(JSON.stringify(options))}` as EnvironmentId;
  const built = buildWallMaze({ ...options, passages, id });
  // All pairs were obtained from in-grid neighbours, so construction cannot fail.
  if (!built.ok) throw new Error(`Backtracker construction invariant: ${built.error.detail}`);
  return Object.freeze({ environment: built.value, seed: options.seed, options, generatorId, generatorVersion });
};
