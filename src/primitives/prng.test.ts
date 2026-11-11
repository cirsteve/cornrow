import { describe, expect, it } from 'vitest';
import { createPrng, hashSeed } from './prng';
import { err, ok } from './result';

describe('seeded primitives', () => {
  it('repeats sequences per instance and diverges for different seeds', () => {
    const sequence = (seed: number) => {
      const prng = createPrng(seed);
      return Array.from({ length: 30 }, () => prng.next());
    };
    expect(sequence(42)).toEqual(sequence(42));
    expect(sequence(42)).not.toEqual(sequence(43));
    expect(sequence(1).slice(0, 3)).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });

  it('keeps draws and bounded integers in range', () => {
    const prng = createPrng(0);
    for (let index = 0; index < 10000; index += 1) {
      const value = prng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const integer = prng.nextInt(7);
      expect(Number.isInteger(integer)).toBe(true);
      expect(integer).toBeGreaterThanOrEqual(0);
      expect(integer).toBeLessThan(7);
    }
    expect(prng.nextInt(1)).toBe(0);
  });

  it('rejects invalid integer bounds', () => {
    for (const bound of [0, -1, 0.5, NaN, Infinity]) {
      expect(() => createPrng(1).nextInt(bound)).toThrow(RangeError);
    }
  });

  it('pins string hashing and coerces numeric seeds to uint32', () => {
    expect(hashSeed('hello')).toBe(1335831723);
    expect(hashSeed('cornrow')).toBe(hashSeed('cornrow'));
    expect(hashSeed('cornrow')).not.toBe(hashSeed('other'));
    expect(hashSeed(-1)).toBe(4294967295);
    expect(hashSeed(4294967297)).toBe(1);
  });

  it('represents success and failure as discriminated values', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
    expect(err('invalid')).toEqual({ ok: false, error: 'invalid' });
  });
});
