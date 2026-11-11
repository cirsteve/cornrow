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
export { initialTraceState, applyTraceEvent } from './trace/trace-state';
export type { TraceState } from './trace/trace-state';
export { WALL_NORTH, WALL_EAST, WALL_SOUTH, WALL_WEST } from './render/view-model';
export type { MazeViewModel, CellView, PlaybackStatus } from './render/view-model';
export { selectViewModel } from './render/select-view-model';
export type { DrawingSurface, Point, Rect, Segment, Size } from './render/drawing-surface';
export { createCanvasSurface } from './render/canvas-surface';
export type { CanvasSurface, CanvasResize } from './render/canvas-surface';
export { RecordingSurface } from './render/recording-surface';
export type { DrawingCall } from './render/recording-surface';
export { computeLayout } from './render/layout';
export type { MazeLayout } from './render/layout';
export { palette } from './render/palette';
export { drawMaze } from './render/draw-maze';
export { advanceAccumulator } from './controller/accumulator';
export type { AccumulatorInput, AccumulatorResult } from './controller/accumulator';
export { createAnimationFrameScheduler } from './controller/frame-scheduler';
export type { FrameScheduler, FrameHandle } from './controller/frame-scheduler';
export type { PlaybackState } from './controller/playback-state';
export { createController } from './controller/controller';
export type {
  CornrowController, ControllerOptions, ControllerSnapshot, ControllerEvent,
  ControllerListener, MazeGeneration,
} from './controller/controller';
export { mountCornrow } from './mount/mount-cornrow';
export type { CornrowHandle } from './mount/mount-cornrow';
export type { MountOptions } from './mount/options';
