import type { PlaybackState } from '../controller/playback-state';

export function describeOutcome(playback: PlaybackState, solverLabel: string): string {
  switch (playback.kind) {
    case 'idle': return `Ready to solve with ${solverLabel}`;
    case 'running': return `Solving with ${playback.solverLabel}`;
    case 'paused': return `Paused with ${playback.solverLabel}`;
    case 'finished':
      switch (playback.outcome) {
        case 'found': return `Found a path of ${playback.pathLength} cells after exploring ${playback.exploredCount} cells with ${solverLabel}`;
        case 'unreachable': return `Goal unreachable after exploring ${playback.exploredCount} cells`;
        case 'cancelled': return `Solve cancelled after exploring ${playback.exploredCount} cells`;
      }
  }
}
