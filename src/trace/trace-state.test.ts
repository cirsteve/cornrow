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
  expect(initialTraceState).toEqual({ frontier: new Set(), visited: new Set(), environment: null, current: null, path: null, stepIndex: 0 });
  expect(discovered).toEqual({ ...initialTraceState, frontier: new Set([node]), stepIndex: 1 });
  expect(visited).toEqual({ ...initialTraceState, visited: new Set([node]), current: node, stepIndex: 2 });
  expect(finished).toEqual({ ...visited, path: [node], stepIndex: 3 });
});

it('counts repeated events while sets retain unique nodes', () => {
  const event = { type: 'visit', node: openCorridorMaze.goal } as const;
  const first = applyTraceEvent(initialTraceState, event);
  expect(applyTraceEvent(first, event)).toEqual({ ...first, stepIndex: 2 });
});

import { selectTraceEnvironment } from './trace-state';
it('folds edits and invalidations immutably and selects the current environment', () => {
  const node = openCorridorMaze.start;
  const before = { ...initialTraceState, frontier: new Set([node]), visited: new Set([node]), current: node, path: [node] };
  expect(selectTraceEnvironment(initialTraceState, openCorridorMaze)).toBe(openCorridorMaze);
  const environment = { ...openCorridorMaze, goal: node };
  const edited = applyTraceEvent(before, { type: 'edit', environment });
  expect(edited).toEqual({ ...before, environment, path: null, current: null, stepIndex: 1 });
  expect(edited.environment).toBe(environment);
  expect(selectTraceEnvironment(edited, openCorridorMaze)).toBe(environment);
  const invalidated = applyTraceEvent(before, { type: 'invalidate', nodes: [node, openCorridorMaze.goal] });
  expect(invalidated).toEqual({ ...before, frontier: new Set(), visited: new Set(), stepIndex: 1 });
  expect(before.frontier.has(node)).toBe(true);
  expect(before.visited.has(node)).toBe(true);
});
