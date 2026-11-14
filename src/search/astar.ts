import { pathCost, stepCost } from '../model/environment.js';
import { cellOf, openNeighbours, toNodeId, type NodeId } from '../model/wall-maze.js';
import type { Solver } from './contract.js';
import { MinHeap } from './min-heap.js';
import { reconstructPath } from './path-validity.js';

interface FrontierEntry {
  readonly node: NodeId;
  readonly distance: number;
  readonly heuristic: number;
  readonly sequence: number;
}

export const astar: Solver = function* (maze, endpoints) {
  toNodeId(maze, endpoints.start);
  toNodeId(maze, endpoints.goal);
  const goal = cellOf(maze, endpoints.goal);
  const heuristic = (node: NodeId): number => {
    const cell = cellOf(maze, node);
    return Math.abs(goal.row - cell.row) + Math.abs(goal.col - cell.col);
  };
  const frontier = new MinHeap<FrontierEntry>((first, second) =>
    (first.distance + first.heuristic) - (second.distance + second.heuristic)
      || first.heuristic - second.heuristic || first.sequence - second.sequence);
  const cells = maze.rows * maze.cols;
  const distances = new Float64Array(cells).fill(Infinity);
  const parents = new Int32Array(cells).fill(-1);
  const expanded = new Uint8Array(cells);
  let sequence = 0;
  let exploredCount = 0;
  distances[endpoints.start] = 0;
  frontier.push({ node: endpoints.start, distance: 0, heuristic: heuristic(endpoints.start), sequence: sequence++ });
  yield { type: 'frontier-add', node: endpoints.start };
  while (frontier.size > 0) {
    const current = frontier.pop();
    if (current === undefined) break;
    // Improved entries supersede older heap entries; stale entries emit no visit.
    if (current.distance !== distances[current.node] || expanded[current.node] === 1) continue;
    expanded[current.node] = 1;
    exploredCount += 1;
    yield { type: 'visit', node: current.node };
    if (current.node === endpoints.goal) {
      const path = reconstructPath(maze, parents, endpoints);
      yield { type: 'path', path };
      return { outcome: 'found', path, exploredCount, cost: pathCost(maze, path), space: 'discrete-graph' };
    }
    for (const next of openNeighbours(maze, current.node)) {
      const distance = current.distance + stepCost(maze, next);
      if (expanded[next] === 1 || distance >= (distances[next] ?? Infinity)) continue;
      distances[next] = distance;
      parents[next] = current.node;
      frontier.push({ node: next, distance, heuristic: heuristic(next), sequence: sequence++ });
      yield { type: 'frontier-add', node: next };
    }
  }
  return { outcome: 'unreachable', path: [], exploredCount, cost: null, space: 'discrete-graph' };
};
