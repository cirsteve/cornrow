import type { Environment } from '../model/environment.js';
import type { NodeId, SolverId } from '../model/wall-maze.js';

export interface Endpoints {
  readonly start: NodeId;
  readonly goal: NodeId;
}

export type TraceEvent =
  | { readonly type: 'frontier-add'; readonly node: NodeId }
  | { readonly type: 'visit'; readonly node: NodeId }
  | { readonly type: 'path'; readonly path: readonly NodeId[] }
  | { readonly type: 'edit'; readonly environment: Environment }
  | { readonly type: 'invalidate'; readonly nodes: readonly NodeId[] };

export interface SolveResult {
  readonly outcome: 'found' | 'unreachable' | 'cancelled';
  readonly path: readonly NodeId[];
  readonly exploredCount: number;
  readonly cost: number | null;
  readonly space: 'discrete-graph';
}

export type Solver = (environment: Readonly<Environment>, endpoints: Endpoints) => Generator<TraceEvent, SolveResult>;

export type ResumableStep =
  | { readonly done: false; readonly value: TraceEvent }
  | { readonly done: true; readonly value: SolveResult };

export interface EditApplied {
  readonly events: readonly TraceEvent[];
  readonly hasMoreToSearch: boolean;
}

/** A session retains search state across edits, including after completion. */
export interface ResumableSearch {
  next(): ResumableStep;
  /** Throws RangeError before mutation if dimensions differ or the goal is outside the grid. */
  applyEdit(environment: Readonly<Environment>): EditApplied;
}

export type ResumableSolver = (environment: Readonly<Environment>, endpoints: Endpoints) => ResumableSearch;

export interface SolverDescriptor {
  readonly id: SolverId;
  readonly label: string;
  readonly solver: Solver;
  readonly resumable: ResumableSolver;
}

/** Cancellation belongs to the consumer, which can pass this to iterator.return(). */
export function cancelledResult(exploredCount: number): SolveResult {
  return { outcome: 'cancelled', path: [], exploredCount, cost: null, space: 'discrete-graph' };
}
