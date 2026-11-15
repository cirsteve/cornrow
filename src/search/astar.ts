import { invalidatedNodes } from './resumable-invalidation.js';
import { pathCost, stepCost } from '../model/environment.js';
import { cellOf, openNeighbours, toNodeId, type NodeId } from '../model/wall-maze.js';
import type { ResumableSolver, SolveResult, TraceEvent, Solver } from './contract.js';
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

/** Instance-local continuation; neighbour discovery is suspended between trace events. */
export const astarResumable: ResumableSolver = (initial, endpoints) => {
  toNodeId(initial, endpoints.start);
  toNodeId(initial, endpoints.goal);
  const start = endpoints.start;
  let environment = initial;
  let goal = endpoints.goal;
  const cells = initial.rows * initial.cols;
  const parents = new Int32Array(cells).fill(-1);
  const expanded = new Uint8Array(cells);
  const distances = new Float64Array(cells).fill(Infinity);
  const latestSequence = new Float64Array(cells);
  let sequence = 0;
  let exploredCount = 0;
  let finished: SolveResult | undefined;
  let initialEvent = true;
  let expanding: NodeId | undefined;
  let neighbours: readonly NodeId[] = [];
  let neighbourIndex = 0;
  const heuristic = (node: NodeId): number => {
    const target = cellOf(environment, goal);
    const cell = cellOf(environment, node);
    return Math.abs(target.row - cell.row) + Math.abs(target.col - cell.col);
  };
  const compare = (first: FrontierEntry, second: FrontierEntry): number => (first.distance + first.heuristic) - (second.distance + second.heuristic) || first.heuristic - second.heuristic || first.sequence - second.sequence;
  let frontier = new MinHeap<FrontierEntry>(compare);
  const enqueue = (node: NodeId): void => {
    latestSequence[node] = sequence++;
    frontier.push({ node, distance: distances[node] ?? Infinity, heuristic: heuristic(node), sequence: latestSequence[node] ?? 0 });
  };
  distances[start] = 0;
  enqueue(start);
  const relax = (from: NodeId, node: NodeId): boolean => {
    const distance = (distances[from] ?? Infinity) + stepCost(environment, node);
    if (expanded[node] === 1 || distance >= (distances[node] ?? Infinity)) return false;
    distances[node] = distance;
    parents[node] = from;
    enqueue(node);
    return true;
  };
  const found = (): SolveResult => {
    const path = reconstructPath(environment, parents, { start, goal });
    return { outcome: 'found', path, exploredCount, cost: pathCost(environment, path), space: 'discrete-graph' };
  };
  const live = (node: NodeId): boolean => Number.isFinite(distances[node]) && expanded[node] !== 1;
  return {
    next() {
      if (finished !== undefined) return { done: true, value: finished };
      if (initialEvent) {
        initialEvent = false;
        return { done: false, value: { type: 'frontier-add', node: start } };
      }
      if (expanding === goal) {
        finished = found();
        return { done: false, value: { type: 'path', path: finished.path } };
      }
      if (expanding !== undefined) {
        while (neighbourIndex < neighbours.length) {
          const node = neighbours[neighbourIndex++];
          if (node !== undefined && relax(expanding, node)) {
            return { done: false, value: { type: 'frontier-add', node } };
          }
        }
        expanding = undefined;
      }
      while (frontier.size > 0) {
        const entry = frontier.pop();
        if (entry === undefined || !live(entry.node) || entry.distance !== distances[entry.node] || entry.sequence !== latestSequence[entry.node]) continue;
        const node = entry.node;
        expanded[node] = 1;
        exploredCount++;
        expanding = node;
        neighbours = openNeighbours(environment, node);
        neighbourIndex = 0;
        return { done: false, value: { type: 'visit', node } };
      }
      finished = { outcome: 'unreachable', path: [], exploredCount, cost: null, space: 'discrete-graph' };
      return { done: true, value: finished };
    },
    applyEdit(next) {
      if (next.rows !== initial.rows || next.cols !== initial.cols) throw new RangeError('applyEdit: dimensions differ');
      toNodeId(next, next.goal);
      const events: TraceEvent[] = [{ type: 'edit', environment: next }];
      const invalid = invalidatedNodes({ previous: environment, next, parents, reached: node => Number.isFinite(distances[node]), start });
      for (const node of invalid) {
        distances[node] = Infinity;
        parents[node] = -1;
        expanded[node] = 0;
      }
      if (invalid.length > 0) events.push({ type: 'invalidate', nodes: invalid });
      environment = next;
      goal = next.goal;
      expanding = undefined;
      frontier = new MinHeap<FrontierEntry>(compare);
      for (let index = 0; index < cells; index++) {
        const node = toNodeId(environment, index);
        if (!live(node)) continue;
        const parent = parents[node] ?? -1;
        if (parent >= 0) distances[node] = (distances[parent] ?? Infinity) + stepCost(environment, node);
        frontier.push({ node, distance: distances[node] ?? Infinity, heuristic: heuristic(node), sequence: latestSequence[node] ?? 0 });
      }
      for (let index = 0; index < cells; index++) {
        const node = toNodeId(environment, index);
        if (expanded[node] !== 1) continue;
        for (const neighbour of openNeighbours(environment, node)) {
          if (relax(node, neighbour)) events.push({ type: 'frontier-add', node: neighbour });
        }
      }
      finished = undefined;
      if (expanded[goal] === 1) {
        finished = found();
        events.push({ type: 'path', path: finished.path });
        return { events, hasMoreToSearch: false };
      }
      return { events, hasMoreToSearch: Array.from({ length: cells }, (_, index) => toNodeId(environment, index)).some(live) };
    },
  };
};
