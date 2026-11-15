import type { SolverId } from '../model/wall-maze.js';
import { err, ok, type Result } from '../primitives/result.js';
import { astar, astarResumable } from './astar.js';
import { dijkstra, dijkstraResumable } from './dijkstra.js';
import { bfs, bfsResumable } from './bfs.js';
import type { SolverDescriptor } from './contract.js';

export interface SolverLookupError {
  readonly operation: 'getSolver';
  readonly id: string;
  readonly detail: string;
}

export const solverRegistry: readonly SolverDescriptor[] = Object.freeze([
  Object.freeze({ id: 'bfs' as SolverId, label: 'Breadth-first search', solver: bfs, resumable: bfsResumable }),
  Object.freeze({ id: 'dijkstra' as SolverId, label: 'Dijkstra', solver: dijkstra, resumable: dijkstraResumable }),
  Object.freeze({ id: 'astar' as SolverId, label: 'A* (Manhattan)', solver: astar, resumable: astarResumable }),
]);

export function getSolver(id: string): Result<SolverDescriptor, SolverLookupError> {
  const descriptor = solverRegistry.find(entry => entry.id === id);
  return descriptor === undefined
    ? err({ operation: 'getSolver', id, detail: `Unknown solver: ${id}` })
    : ok(descriptor);
}
