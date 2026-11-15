import type { Environment } from '../model/environment.js';
import type { NodeId } from '../model/wall-maze.js';
import type { TraceEvent } from '../search/contract.js';

export interface TraceState {
  readonly environment: Environment | null;
  readonly frontier: ReadonlySet<NodeId>;
  readonly visited: ReadonlySet<NodeId>;
  readonly current: NodeId | null;
  readonly path: readonly NodeId[] | null;
  readonly stepIndex: number;
}

export const initialTraceState: TraceState = {
  frontier: new Set<NodeId>(), visited: new Set<NodeId>(),
  environment: null, current: null, path: null, stepIndex: 0,
};

export function applyTraceEvent(state: TraceState, event: TraceEvent): TraceState {
  const stepIndex = state.stepIndex + 1;
  switch (event.type) {
    case 'frontier-add':
      return { ...state, frontier: new Set([...state.frontier, event.node]), stepIndex };
    case 'visit': {
      const frontier = new Set(state.frontier);
      frontier.delete(event.node);
      return { ...state, frontier, visited: new Set([...state.visited, event.node]), current: event.node, stepIndex };
    }
    case 'edit':
      return { ...state, environment: event.environment, path: null, current: null, stepIndex };
    case 'invalidate': {
      const frontier = new Set(state.frontier);
      const visited = new Set(state.visited);
      for (const node of event.nodes) { frontier.delete(node); visited.delete(node); }
      return { ...state, frontier, visited, stepIndex };
    }
    case 'path':
      return { ...state, path: [...event.path], stepIndex };
  }
}

export function selectTraceEnvironment(state: TraceState, base: Environment): Environment {
  return state.environment ?? base;
}
