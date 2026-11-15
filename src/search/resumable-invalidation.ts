import { hasPassage, toNodeId, type NodeId, type PassageGrid } from '../model/wall-maze.js';

export interface InvalidationInput {
  readonly previous: PassageGrid;
  readonly next: PassageGrid;
  readonly parents: Int32Array;
  readonly reached: (node: NodeId) => boolean;
  readonly start: NodeId;
}

/** Find cut parent edges, then walk their reached descendants in linear time. */
export function invalidatedNodes({ previous, next, parents, reached, start }: InvalidationInput): readonly NodeId[] {
  const children: NodeId[][] = Array.from({ length: parents.length }, () => []);
  const roots: NodeId[] = [];
  for (let index = 0; index < parents.length; index++) {
    const node = toNodeId(previous, index);
    const parent = parents[node] ?? -1;
    if (node === start || !reached(node) || parent < 0) continue;
    const parentNode = toNodeId(previous, parent);
    children[parent]?.push(node);
    if (hasPassage(previous, parentNode, node) && !hasPassage(next, parentNode, node)) roots.push(node);
  }
  const invalid = new Set<NodeId>();
  while (roots.length > 0) {
    const node = roots.pop();
    if (node === undefined || invalid.has(node)) continue;
    invalid.add(node);
    roots.push(...(children[node] ?? []));
  }
  return [...invalid].sort((a, b) => a - b);
}
