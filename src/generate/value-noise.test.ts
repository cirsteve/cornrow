import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPrng, hashSeed, type Prng } from '../primitives/prng.js';
import { valueNoise } from './value-noise.js';

const options = { lattice: 4, octaves: 2 } as const;

it.each([{ rows: 5, cols: 5 }, { rows: 10, cols: 13 }, { rows: 80, cols: 80 }])('draws exactly the two row-major lattices for $rows x $cols', grid => {
  const random = createPrng(hashSeed('cornrow'));
  let draws = 0;
  const counting: Prng = { next: () => { draws += 1; return random.next(); }, nextInt: () => { throw new Error('Unexpected integer draw'); } };
  const values = valueNoise(grid, counting, options);
  expect(values).toHaveLength(grid.rows * grid.cols);
  expect([...values].every(value => value >= 0 && value < 1)).toBe(true);
  expect(draws).toBe((Math.ceil(grid.rows / 4) + 1) * (Math.ceil(grid.cols / 4) + 1)
    + (Math.ceil(grid.rows / 2) + 1) * (Math.ceil(grid.cols / 2) + 1));
  expect(values).toEqual(valueNoise(grid, createPrng(hashSeed('cornrow')), options));
  expect(values).not.toEqual(valueNoise(grid, createPrng(hashSeed('other')), options));
});

it('uses smoothstep bilinear interpolation and half-amplitude fine noise', () => {
  const random = createPrng(42);
  const coarse = Array.from({ length: 9 }, () => random.next());
  const fine = Array.from({ length: 16 }, () => random.next());
  const values = valueNoise({ rows: 5, cols: 5 }, createPrng(42), options);
  expect(values[0]).toBe(((coarse[0] ?? 0) + 0.5 * (fine[0] ?? 0)) / 1.5);
  // At (2,2) the coarse sample is the mean of its four corners; the fine is on a lattice point.
  const middle = ((coarse[0] ?? 0) + (coarse[1] ?? 0) + (coarse[3] ?? 0) + (coarse[4] ?? 0)) / 4;
  expect(values[12]).toBeCloseTo((middle + 0.5 * (fine[5] ?? 0)) / 1.5, 15);
});

it('avoids engine-dependent transcendental functions and exponentiation', () => {
  expect(readFileSync(new URL('./value-noise.ts', import.meta.url), 'utf8')).not.toMatch(/Math\.(sin|exp|pow)|\*\*/);
});
