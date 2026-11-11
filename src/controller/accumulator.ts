export interface AccumulatorInput {
  readonly carryMs: number;
  readonly elapsedMs: number;
  readonly stepsPerSecond: number;
  readonly maxStepsPerFrame?: number;
  readonly maxElapsedMs?: number;
}
export interface AccumulatorResult { readonly steps: number; readonly carryMs: number }

/**
 * Direct-return frame primitive; invalid caller configuration is a programmer error.
 * @throws RangeError for non-finite timing values, negative carry/max elapsed,
 * non-positive speed or a non-positive/non-integer step cap. Negative elapsed is clamped.
 */
export function advanceAccumulator({ carryMs, elapsedMs, stepsPerSecond, maxStepsPerFrame = 500, maxElapsedMs = 250 }: AccumulatorInput): AccumulatorResult {
  if (!Number.isFinite(carryMs) || carryMs < 0 || !Number.isFinite(elapsedMs)
    || !Number.isFinite(stepsPerSecond) || stepsPerSecond <= 0
    || !Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame <= 0
    || !Number.isFinite(maxElapsedMs) || maxElapsedMs < 0) {
    throw new RangeError('advanceAccumulator: invalid timing options');
  }
  const totalMs = carryMs + Math.max(0, Math.min(elapsedMs, maxElapsedMs));
  // A tiny tolerance keeps integral steps stable across fractional frame durations.
  const available = Math.floor(totalMs * stepsPerSecond / 1000 + 1e-9);
  const steps = Math.min(available, maxStepsPerFrame);
  return { steps, carryMs: steps === maxStepsPerFrame ? 0 : Math.max(0, totalMs - steps * 1000 / stepsPerSecond) };
}
