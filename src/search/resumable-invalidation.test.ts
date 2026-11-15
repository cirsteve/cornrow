import { expect, it } from 'vitest';
import { comparisonMaze } from '../model/fixtures';
import { toNodeId } from '../model/wall-maze';
import { invalidatedNodes } from './resumable-invalidation';

const previous = comparisonMaze;
const start = previous.start;
const parents = new Int32Array(25).fill(-1);
parents[1] = 0; parents[2] = 1; parents[3] = 2; parents[5] = 0; parents[6] = 5;
const reached = (node: number) => [0, 1, 2, 3, 5, 6].includes(node);
function without(from: number, to: number) {
  const passages = [...previous.passages];
  const bit = to - from === 1 ? 2 : 4;
  passages[from] = (passages[from] ?? 0) & ~bit;
  passages[to] = (passages[to] ?? 0) & ~(bit === 2 ? 8 : 1);
  return { ...previous, passages };
}
it('returns sorted reached subtrees of cut parent edges without duplicates', () => {
  expect(invalidatedNodes({ previous, next: without(0, 1), parents, reached, start })).toEqual([1, 2, 3]);
  expect(invalidatedNodes({ previous, next: without(1, 2), parents, reached, start })).toEqual([2, 3]);
});
it('ignores cuts outside the parent tree and never invalidates start', () => {
  expect(invalidatedNodes({ previous, next: without(1, 6), parents, reached, start })).toEqual([]);
  expect(invalidatedNodes({ previous, next: without(0, 5), parents, reached, start })).toEqual([5, 6]);
});
it('ignores openings and unreached nodes', () => {
  expect(invalidatedNodes({ previous: without(1, 2), next: previous, parents, reached, start })).toEqual([]);
  expect(invalidatedNodes({ previous, next: without(1, 2), parents, reached: node => node === start || node === toNodeId(previous, 1), start })).toEqual([]);
});
