import { expect, it } from 'vitest';
import { openCorridorMaze as maze } from '../model/fixtures';
import { toNodeId } from '../model/wall-maze';
import { initialTraceState } from '../trace/trace-state';
import { selectViewModel } from './select-view-model';

it('derives wall masks and endpoints only from the maze', () => {
  const view = selectViewModel(maze, initialTraceState, { kind: 'idle' });
  expect(view).toMatchObject({ rows: 5, cols: 5, start: maze.start, goal: maze.goal, current: null, path: null });
  expect(view.cells[0]).toEqual({ costBand: null, wallMask: 13, layer: 'empty' });
  expect(view.cells[4]).toEqual({ costBand: null, wallMask: 3, layer: 'empty' });
  expect(view.cells[24]?.wallMask).toBe(14);
  expect(view.cells[12]?.wallMask).toBe(15);
});

it('resolves path over visited over frontier and passes through playback and the ordered path', () => {
  const nodes = [0, 1, 2, 3].map(index => toNodeId(maze, index));
  const path = [maze.start, toNodeId(maze, 1)];
  const playback = { kind: 'paused', solverLabel: 'Injected' } as const;
  const trace = { ...initialTraceState, frontier: new Set(nodes), visited: new Set(nodes.slice(0, 3)), path, current: maze.start };
  const before = JSON.stringify(maze);
  const view = selectViewModel(maze, trace, playback);
  expect(view.cells.slice(0, 5).map(cell => cell.layer)).toEqual(['path', 'path', 'visited', 'frontier', 'empty']);
  expect(view.path).toBe(path);
  expect(view.current).toBe(maze.start);
  expect(view.playback).toBe(playback);
  expect(trace.frontier.size).toBe(4);
  expect(JSON.stringify(maze)).toBe(before);
});

import { ridgeTerrain } from '../model/fixtures.js';
import { TERRAIN_COSTS } from '../model/terrain-maze.js';
import { terrainCostBand } from './select-view-model.js';

it('selects the environment and cost bands without changing wall layers', () => {
  const wall = selectViewModel(maze, initialTraceState, { kind: 'idle' });
  expect(wall.environment).toBe('wall-maze');
  expect(wall.cells.every(cell => cell.costBand === null)).toBe(true);
  const terrain = selectViewModel(ridgeTerrain, initialTraceState, { kind: 'idle' });
  expect(terrain.environment).toBe('terrain');
  expect(terrain.cells.map(cell => cell.costBand)).toEqual(Array.from({ length: 25 }, (_, node) => [2, 7, 12, 17].includes(node) ? 3 : 0));
  expect(TERRAIN_COSTS.map(terrainCostBand)).toEqual([0, 1, 2, 3]);
});
