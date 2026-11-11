import type { GenerationResult, WallMazeOptions } from './generate/contract';
import { recursiveBacktracker } from './generate/recursive-backtracker';
import type { SolverId, WallMaze } from './model/wall-maze';
import type { Endpoints, SolveResult, TraceEvent } from './search/contract';
import { getSolver } from './search/registry';

export interface SolveTrace {
  readonly result: SolveResult;
  readonly events: readonly TraceEvent[];
}

export function generate(options: WallMazeOptions): GenerationResult<WallMaze, WallMazeOptions> {
  return recursiveBacktracker(options);
}

/** Drain a registered stepper. Use getSolver to validate user input and obtain a branded id.
 * @throws RangeError when solverId is unknown or an endpoint is outside the maze.
 */
export function solve(environment: WallMaze, solverId: SolverId, endpoints: Endpoints = environment): SolveTrace {
  const descriptor = getSolver(solverId);
  if (!descriptor.ok) throw new RangeError(descriptor.error.detail);
  const iterator = descriptor.value.solver(environment, endpoints);
  const events: TraceEvent[] = [];
  let step = iterator.next();
  while (!step.done) {
    events.push(step.value);
    step = iterator.next();
  }
  return { result: step.value, events: Object.freeze(events) };
}

export { ok, err } from './primitives/result';
export type { Result } from './primitives/result';
export type { Brand } from './primitives/brand';
export { hashSeed, createPrng } from './primitives/prng';
export type { Prng } from './primitives/prng';
export {
  buildWallMaze, clampGridSize, nodeIdOf, toNodeId, cellOf,
  neighbours, openNeighbours, hasPassage,
} from './model/wall-maze';
export type {
  WallMaze, GridSize, CellCoord, NodeId, EnvironmentId, GeneratorId, SolverId,
  WallMazeBuildOptions, MazeBuildError, PassagePair,
} from './model/wall-maze';
export type { WallMazeGenerator, WallMazeOptions, GenerationResult } from './generate/contract';
export { recursiveBacktracker, generatorId, generatorVersion } from './generate/recursive-backtracker';
export { validateWallMaze } from './generate/validate-maze';
export type { MazeValidationError } from './generate/validate-maze';
export { bfs } from './search/bfs';
export { astar } from './search/astar';
export { cancelledResult } from './search/contract';
export type { Endpoints, SolveResult, TraceEvent, Solver, SolverDescriptor } from './search/contract';
export { solverRegistry, getSolver } from './search/registry';
export type { SolverLookupError } from './search/registry';
export { checkPath } from './search/path-validity';
export type { PathValidityError } from './search/path-validity';
