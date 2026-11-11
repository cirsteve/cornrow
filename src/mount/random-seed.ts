let sequence = 0;

/** Randomness belongs to this browser boundary; generation remains deterministic. */
export function randomSeed(): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const values = globalThis.crypto.getRandomValues(new Uint32Array(2));
    return Array.from(values, value => value.toString(36)).join('-');
  }
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence.toString(36)}`;
}
