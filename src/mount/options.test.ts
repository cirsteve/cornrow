import { expect, it } from 'vitest';
import { normaliseMountOptions, type MountOptions } from './options.js';

it.each([[undefined, 'wall-maze'], ['terrain', 'terrain'], ['lava', 'wall-maze']] as const)('normalises environment %s to %s', (environment, expected) => {
  const options = environment === undefined ? {} : { environment } as MountOptions;
  expect(normaliseMountOptions(options, 'seed').environment).toBe(expected);
});

it.each([[1.5, 1], [-0.2, 0], [NaN, 0.5], [Infinity, 0.5], [undefined, 0.5]])('normalises openness %s to %s', (openness, expected) => {
  const options = openness === undefined ? {} : { openness };
  const before = { ...options };
  expect(normaliseMountOptions(options, 'seed').openness).toBe(expected);
  expect(options).toEqual(before);
});
