import type { PlaybackStatus } from '../render/view-model.js';
import type { SolveResult } from '../search/contract.js';

export type PlaybackState = PlaybackStatus;
export function pausePlayback(state: PlaybackState): PlaybackState {
  return state.kind === 'running' ? { ...state, kind: 'paused' } : state;
}
export function resumePlayback(state: PlaybackState): PlaybackState {
  return state.kind === 'paused' ? { ...state, kind: 'running' } : state;
}
export function finishPlayback(result: SolveResult): PlaybackState {
  return { kind: 'finished', outcome: result.outcome, pathLength: result.path.length, pathCost: result.cost, exploredCount: result.exploredCount };
}
