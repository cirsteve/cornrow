import { expect, it } from 'vitest';
import { mergeEnvironmentOptions } from './merge-environment-options.js';
import type { EnvironmentOptions } from '../generate/contract.js';

it('preserves seed, dimensions and openness across kind switches without mutating inputs', () => {
  const original: EnvironmentOptions = Object.freeze({ kind: 'terrain', seed: 'cornrow', rows: 10, cols: 12, openness: 0.7 });
  const patch = Object.freeze({ kind: 'wall-maze' } as const);
  const wall = mergeEnvironmentOptions(original, patch);
  expect(wall).toEqual({ ...original, kind: 'wall-maze' });
  expect(mergeEnvironmentOptions(wall, { kind: 'terrain' })).toEqual(original);
  expect(mergeEnvironmentOptions(wall, { seed: 'new' })).toEqual({ ...wall, seed: 'new' });
  expect(original.kind).toBe('terrain');
  expect(patch).toEqual({ kind: 'wall-maze' });
});
