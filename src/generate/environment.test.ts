import { expect, it } from 'vitest';
import { generateEnvironment } from './environment.js';
import { recursiveBacktracker } from './recursive-backtracker.js';
import { braidedTerrain } from './terrain.js';

it('dispatches missing and explicit wall-maze kind to the backtracker', () => {
  const options = { seed: 'cornrow', rows: 10, cols: 10 };
  expect(generateEnvironment(options)).toEqual(recursiveBacktracker(options));
  expect(generateEnvironment({ ...options, kind: 'wall-maze' })).toEqual(recursiveBacktracker(options));
});

it('dispatches terrain to braided value noise', () => {
  const options = { seed: 'cornrow', rows: 10, cols: 10, openness: 0.7 };
  expect(generateEnvironment({ ...options, kind: 'terrain' })).toEqual(braidedTerrain(options));
});
