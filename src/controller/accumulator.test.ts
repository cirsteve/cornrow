import { expect, it } from 'vitest';
import { advanceAccumulator } from './accumulator';

it.each([30, 60, 144])('advances 120 steps per second at %i Hz', hz => {
  let carryMs = 0;
  let steps = 0;
  for (let frame = 0; frame < hz; frame += 1) {
    const result = advanceAccumulator({ carryMs, elapsedMs: 1000 / hz, stepsPerSecond: 120 });
    carryMs = result.carryMs;
    steps += result.steps;
  }
  expect(steps).toBe(120);
  expect(carryMs).toBeCloseTo(0);
});

it('carries fractional steps, clamps a long frame and drops carry at the cap', () => {
  expect(advanceAccumulator({ carryMs: 10, elapsedMs: 15, stepsPerSecond: 60 })).toEqual({ steps: 1, carryMs: 25 - 1000 / 60 });
  expect(advanceAccumulator({ carryMs: 0, elapsedMs: 60_000, stepsPerSecond: 100 })).toEqual({ steps: 25, carryMs: 0 });
  expect(advanceAccumulator({ carryMs: 12, elapsedMs: 250, stepsPerSecond: 10000 })).toEqual({ steps: 500, carryMs: 0 });
  expect(advanceAccumulator({ carryMs: 10, elapsedMs: 250, stepsPerSecond: 60, maxStepsPerFrame: 2 })).toEqual({ steps: 2, carryMs: 0 });
});

it('ignores negative elapsed time and rejects invalid speeds', () => {
  expect(advanceAccumulator({ carryMs: 5, elapsedMs: -10, stepsPerSecond: 60 })).toEqual({ steps: 0, carryMs: 5 });
  expect(() => advanceAccumulator({ carryMs: 0, elapsedMs: 10, stepsPerSecond: NaN })).toThrow(RangeError);
});
