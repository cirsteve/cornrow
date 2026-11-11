export interface Prng {
  next(): number;
  nextInt(maxExclusive: number): number;
}

/** FNV-1a over UTF-16 code units; numeric seeds retain their low 32 bits. */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

export function createPrng(seed: number): Prng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt(maxExclusive) {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError('nextInt requires a positive safe integer bound');
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}
