import { expect, it, vi } from 'vitest';
import { mountCornrow } from '../index';
import { randomSeed } from './random-seed';
import { describeOutcome } from './status-text';
import { normaliseMountOptions } from './options';
import type { SolverId } from '../model/wall-maze';

it('describes successful, unreachable and cancelled outcomes in plain text', () => {
  expect(describeOutcome({ kind: 'finished', outcome: 'found', pathLength: 37, pathCost: 36, exploredCount: 120 }, 'Breadth-first search'))
    .toBe('Found a path of 37 cells after exploring 120 cells with Breadth-first search');
  expect(describeOutcome({ kind: 'finished', outcome: 'unreachable', pathLength: 0, pathCost: null, exploredCount: 24 }, 'BFS'))
    .toBe('Goal unreachable after exploring 24 cells');
  expect(describeOutcome({ kind: 'finished', outcome: 'cancelled', pathLength: 0, pathCost: null, exploredCount: 12 }, 'BFS'))
    .toBe('Solve cancelled after exploring 12 cells');
});

it('describes idle, running and paused playback', () => {
  expect(describeOutcome({ kind: 'idle' }, 'BFS')).toBe('Ready to solve with BFS');
  expect(describeOutcome({ kind: 'running', solverLabel: 'A*' }, 'BFS')).toBe('Solving with A*');
  expect(describeOutcome({ kind: 'paused', solverLabel: 'A*' }, 'BFS')).toBe('Paused with A*');
});

it('normalises options purely with injected seed entropy and bounded dimensions/speed', () => {
  expect(normaliseMountOptions({}, 'fresh')).toEqual({ mode: 'interactive', seed: 'fresh', rows: 20, cols: 20, solver: 'bfs', stepsPerSecond: 60, label: 'Cornrow maze' });
  expect(normaliseMountOptions({ rows: NaN, cols: Infinity, solver: 'unknown' as SolverId, stepsPerSecond: -5, seed: '' }, 'unused'))
    .toMatchObject({ rows: 5, cols: 80, solver: 'bfs', stepsPerSecond: 1, seed: '' });
  expect(normaliseMountOptions({ rows: 3, cols: 100, stepsPerSecond: NaN }, 'seed')).toMatchObject({ rows: 5, cols: 80, stepsPerSecond: 60 });
  expect(normaliseMountOptions({ stepsPerSecond: 900 }, 'seed').stepsPerSecond).toBe(500);
  expect(normaliseMountOptions({ seed: 42 }, 'unused').seed).toBe('42');
  expect(normaliseMountOptions({}, 42).seed).toBe('42');
});

it('imports the public mount entry in node without requiring DOM globals', () => {
  expect(typeof document).toBe('undefined');
  expect(typeof window).toBe('undefined');
  expect(typeof mountCornrow).toBe('function');
});

it('uses a monotonic fallback seed when crypto is unavailable', () => {
  vi.stubGlobal('crypto', undefined);
  vi.spyOn(Date, 'now').mockReturnValue(1234);
  try {
    const first = randomSeed();
    const second = randomSeed();
    expect(first).not.toBe(second);
    expect(first.split('-')[0]).toBe((1234).toString(36));
  } finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});
