import { expect, it } from 'vitest';
import { finishPlayback } from './playback-state.js';
import { cancelledResult } from '../search/contract.js';
import type { SolverId } from '../model/wall-maze.js';
import { solve } from '../index.js';
import { ridgeTerrain, isolatedGoalMaze } from '../model/fixtures.js';

it('finishes with result cost for found, unreachable and cancelled solves', () => {
  for (const result of [solve(ridgeTerrain, 'dijkstra' as SolverId).result, solve(isolatedGoalMaze, 'bfs' as SolverId).result, cancelledResult(4)]) {
    expect(finishPlayback(result)).toMatchObject({ kind: 'finished', pathCost: result.cost });
  }
});
