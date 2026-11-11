import { expect, it } from 'vitest';
import { nextBackgroundPhase, type BackgroundPhase } from './background-loop';

it('generates, solves, holds for 2.5 seconds, then alternates solvers', () => {
  const advance = (phase: BackgroundPhase, solved = false, elapsedMs = 0) =>
    nextBackgroundPhase(phase, { solved, elapsedMs, solverCount: 2 });
  const solving = advance({ kind: 'generating', solverIndex: 0 });
  expect(solving).toEqual({ kind: 'solving', solverIndex: 0 });
  expect(advance(solving)).toBe(solving);
  const holding = advance(solving, true);
  expect(holding).toEqual({ kind: 'holding', solverIndex: 0, elapsedMs: 0 });
  const almost = advance(holding, false, 2499);
  expect(almost.kind).toBe('holding');
  expect(advance(almost, false, -100)).toEqual(almost);
  const regenerating = advance(almost, false, 1);
  expect(regenerating).toEqual({ kind: 'generating', solverIndex: 1 });
  const secondHold = advance(advance(regenerating), true);
  expect(advance(secondHold, false, 2500)).toEqual({ kind: 'generating', solverIndex: 0 });
});
