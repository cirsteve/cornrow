import type { EnvironmentOptions } from '../generate/contract.js';

/** Keep latent terrain options when switching back to a wall maze. */
export function mergeEnvironmentOptions(current: EnvironmentOptions, patch: Partial<EnvironmentOptions>): EnvironmentOptions {
  return { ...current, ...patch };
}
