import type { Environment } from '../model/environment.js';
import type { NodeId, SolverId } from '../model/wall-maze.js';

export interface Endpoints {
  readonly start: NodeId;
  readonly goal: NodeId;
}

export type TraceEvent =
  | { readonly type: 'frontier-add'; readonly node: NodeId }
  | { readonly type: 'visit'; readonly node: NodeId }
  | { readonly type: 'path'; readonly path: readonly NodeId[] };

export interface SolveResult {
  readonly outcome: 'found' | 'unreachable' | 'cancelled';
  readonly path: readonly NodeId[];
  readonly exploredCount: number;
  readonly cost: number | null;
  readonly space: 'discrete-graph';
}

export type Solver = (environment: Readonly<Environment>, endpoints: Endpoints) => Generator<TraceEvent, SolveResult>;

export interface SolverDescriptor {
  readonly id: SolverId;
  readonly label: string;
  readonly solver: Solver;
}

/** Cancellation belongs to the consumer, which can pass this to iterator.return(). */
export function cancelledResult(exploredCount: number): SolveResult {
  return { outcome: 'cancelled', path: [], exploredCount, cost: null, space: 'discrete-graph' };
}
