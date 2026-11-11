import type { GenerationResult, WallMazeOptions } from './generate/contract.js';
import { recursiveBacktracker } from './generate/recursive-backtracker.js';
import type { SolverId, WallMaze } from './model/wall-maze.js';
import type { Endpoints, SolveResult, TraceEvent } from './search/contract.js';
import { getSolver } from './search/registry.js';

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

export { ok, err } from './primitives/result.js';
export type { Result } from './primitives/result.js';
export type { Brand } from './primitives/brand.js';
export { hashSeed, createPrng } from './primitives/prng.js';
export type { Prng } from './primitives/prng.js';
export {
  buildWallMaze, clampGridSize, nodeIdOf, toNodeId, cellOf,
  neighbours, openNeighbours, hasPassage,
} from './model/wall-maze.js';
export type {
  WallMaze, GridSize, CellCoord, NodeId, EnvironmentId, GeneratorId, SolverId,
  WallMazeBuildOptions, MazeBuildError, PassagePair,
} from './model/wall-maze.js';
export type { WallMazeGenerator, WallMazeOptions, GenerationResult } from './generate/contract.js';
export { recursiveBacktracker, generatorId, generatorVersion } from './generate/recursive-backtracker.js';
export { validateWallMaze } from './generate/validate-maze.js';
export type { MazeValidationError } from './generate/validate-maze.js';
export { bfs } from './search/bfs.js';
export { astar } from './search/astar.js';
export { cancelledResult } from './search/contract.js';
export type { Endpoints, SolveResult, TraceEvent, Solver, SolverDescriptor } from './search/contract.js';
export { solverRegistry, getSolver } from './search/registry.js';
export type { SolverLookupError } from './search/registry.js';
export { checkPath } from './search/path-validity.js';
export type { PathValidityError } from './search/path-validity.js';
export { initialTraceState, applyTraceEvent } from './trace/trace-state.js';
export type { TraceState } from './trace/trace-state.js';
export { WALL_NORTH, WALL_EAST, WALL_SOUTH, WALL_WEST } from './render/view-model.js';
export type { MazeViewModel, CellView, PlaybackStatus } from './render/view-model.js';
export { selectViewModel } from './render/select-view-model.js';
export type { DrawingSurface, Point, Rect, Segment, Size } from './render/drawing-surface.js';
export { createCanvasSurface } from './render/canvas-surface.js';
export type { CanvasSurface, CanvasResize } from './render/canvas-surface.js';
export { RecordingSurface } from './render/recording-surface.js';
export type { DrawingCall } from './render/recording-surface.js';
export { computeLayout } from './render/layout.js';
export type { MazeLayout } from './render/layout.js';
export { palette } from './render/palette.js';
export { drawMaze } from './render/draw-maze.js';
export { advanceAccumulator } from './controller/accumulator.js';
export type { AccumulatorInput, AccumulatorResult } from './controller/accumulator.js';
export { createAnimationFrameScheduler } from './controller/frame-scheduler.js';
export type { FrameScheduler, FrameHandle } from './controller/frame-scheduler.js';
export type { PlaybackState } from './controller/playback-state.js';
export { createController } from './controller/controller.js';
export type {
  CornrowController, ControllerOptions, ControllerSnapshot, ControllerEvent,
  ControllerListener, MazeGeneration,
} from './controller/controller.js';
export { mountCornrow } from './mount/mount-cornrow.js';
export type { CornrowHandle } from './mount/mount-cornrow.js';
export type { MountOptions } from './mount/options.js';
