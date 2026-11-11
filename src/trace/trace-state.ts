import type { NodeId } from '../model/wall-maze';
import type { TraceEvent } from '../search/contract';

export interface TraceState {
  readonly frontier: ReadonlySet<NodeId>;
  readonly visited: ReadonlySet<NodeId>;
  readonly current: NodeId | null;
  readonly path: readonly NodeId[] | null;
  readonly stepIndex: number;
}

export const initialTraceState: TraceState = {
  frontier: new Set<NodeId>(), visited: new Set<NodeId>(),
  current: null, path: null, stepIndex: 0,
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
    case 'path':
      return { ...state, path: [...event.path], stepIndex };
  }
}
