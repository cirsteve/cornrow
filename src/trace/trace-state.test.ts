import { expect, it } from 'vitest';
import { openCorridorMaze } from '../model/fixtures';
import { applyTraceEvent, initialTraceState } from './trace-state';

it('folds discovery, visit and path without mutating earlier states or event paths', () => {
  const node = openCorridorMaze.start;
  const discovered = applyTraceEvent(initialTraceState, { type: 'frontier-add', node });
  const visited = applyTraceEvent(discovered, { type: 'visit', node });
  const path = [node];
  const finished = applyTraceEvent(visited, { type: 'path', path });
  path.push(openCorridorMaze.goal);
  expect(initialTraceState).toEqual({ frontier: new Set(), visited: new Set(), current: null, path: null, stepIndex: 0 });
  expect(discovered).toEqual({ ...initialTraceState, frontier: new Set([node]), stepIndex: 1 });
  expect(visited).toEqual({ ...initialTraceState, visited: new Set([node]), current: node, stepIndex: 2 });
  expect(finished).toEqual({ ...visited, path: [node], stepIndex: 3 });
});

it('counts repeated events while sets retain unique nodes', () => {
  const event = { type: 'visit', node: openCorridorMaze.goal } as const;
  const first = applyTraceEvent(initialTraceState, event);
  expect(applyTraceEvent(first, event)).toEqual({ ...first, stepIndex: 2 });
});
