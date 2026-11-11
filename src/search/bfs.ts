import { openNeighbours, toNodeId } from '../model/wall-maze';
import type { Solver } from './contract';
import { reconstructPath } from './path-validity';

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
      return { outcome: 'found', path, exploredCount, space: 'discrete-graph' };
    }
    for (const next of openNeighbours(maze, current)) {
      if (discovered[next] === 1) continue;
      discovered[next] = 1;
      parents[next] = current;
      queue.push(next);
      yield { type: 'frontier-add', node: next };
    }
  }
  return { outcome: 'unreachable', path: [], exploredCount, space: 'discrete-graph' };
};
