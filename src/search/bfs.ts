import { invalidatedNodes } from './resumable-invalidation.js';
import { pathCost } from '../model/environment.js';
import { openNeighbours, toNodeId, type NodeId } from '../model/wall-maze.js';
import type { ResumableSolver, SolveResult, TraceEvent, Solver } from './contract.js';
import { reconstructPath } from './path-validity.js';

export const bfs: Solver = function* (maze, endpoints) {
  toNodeId(maze, endpoints.start);
  toNodeId(maze, endpoints.goal);
  const cells = maze.rows * maze.cols;
  const parents = new Int32Array(cells).fill(-1);
  const discovered = new Uint8Array(cells);
  const queue = [endpoints.start];
  discovered[endpoints.start] = 1;
  let exploredCount = 0;
  yield { type: 'frontier-add', node: endpoints.start };
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (current === undefined) break;
    exploredCount += 1;
    yield { type: 'visit', node: current };
    if (current === endpoints.goal) {
      const path = reconstructPath(maze, parents, endpoints);
      yield { type: 'path', path };
      return { outcome: 'found', path, exploredCount, cost: pathCost(maze, path), space: 'discrete-graph' };
    }
    for (const next of openNeighbours(maze, current)) {
      if (discovered[next] === 1) continue;
      discovered[next] = 1;
      parents[next] = current;
      queue.push(next);
      yield { type: 'frontier-add', node: next };
    }
  }
  return { outcome: 'unreachable', path: [], exploredCount, cost: null, space: 'discrete-graph' };
};

/** Instance-local continuation; neighbour discovery is suspended between trace events. */
export const bfsResumable: ResumableSolver = (initial, endpoints) => {
  toNodeId(initial, endpoints.start);
  toNodeId(initial, endpoints.goal);
  const start = endpoints.start;
  let environment = initial;
  let goal = endpoints.goal;
  const cells = initial.rows * initial.cols;
  const parents = new Int32Array(cells).fill(-1);
  const expanded = new Uint8Array(cells);
  const discovered = new Uint8Array(cells);
  const enqueuedSequence = new Float64Array(cells).fill(-1);
  let sequence = 0;
  let exploredCount = 0;
  let finished: SolveResult | undefined;
  let initialEvent = true;
  let expanding: NodeId | undefined;
  let neighbours: readonly NodeId[] = [];
  let neighbourIndex = 0;
  const queue: { node: NodeId; sequence: number }[] = [];
  let head = 0;
  const enqueue = (node: NodeId): void => {
    enqueuedSequence[node] = sequence;
    queue.push({ node, sequence: sequence++ });
  };
  discovered[start] = 1;
  enqueue(start);
  const relax = (from: NodeId, node: NodeId): boolean => {
    if (discovered[node] === 1 || expanded[node] === 1) return false;
    discovered[node] = 1;
    parents[node] = from;
    enqueue(node);
    return true;
  };
  const found = (): SolveResult => {
    const path = reconstructPath(environment, parents, { start, goal });
    return { outcome: 'found', path, exploredCount, cost: pathCost(environment, path), space: 'discrete-graph' };
  };
  const live = (node: NodeId): boolean => discovered[node] === 1 && expanded[node] !== 1;
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
      while (head < queue.length) {
        const entry = queue[head++];
        if (entry === undefined || !live(entry.node) || entry.sequence !== enqueuedSequence[entry.node]) continue;
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
      const invalid = invalidatedNodes({ previous: environment, next, parents, reached: node => discovered[node] === 1, start });
      for (const node of invalid) {
        discovered[node] = 0;
        enqueuedSequence[node] = -1;
        parents[node] = -1;
        expanded[node] = 0;
      }
      if (invalid.length > 0) events.push({ type: 'invalidate', nodes: invalid });
      environment = next;
      goal = next.goal;
      expanding = undefined;

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
