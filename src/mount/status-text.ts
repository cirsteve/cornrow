import type { CellCoord } from '../model/wall-maze.js';
import type { PlaybackState } from '../controller/playback-state.js';

export function describeOutcome(playback: PlaybackState, solverLabel: string, environmentKind: 'wall-maze' | 'terrain'): string {
  switch (playback.kind) {
    case 'idle': return `Ready to solve with ${solverLabel}`;
    case 'running': return `Solving with ${playback.solverLabel}`;
    case 'paused': return `Paused with ${playback.solverLabel}`;
    case 'finished':
      switch (playback.outcome) {
        case 'found': return `Found a path of ${playback.pathLength} cells${environmentKind === 'terrain' ? ` (cost ${playback.pathCost})` : ''} after exploring ${playback.exploredCount} cells with ${solverLabel}`;
        case 'unreachable': return `Goal unreachable after exploring ${playback.exploredCount} cells`;
        case 'cancelled': return `Solve cancelled after exploring ${playback.exploredCount} cells`;
      }
  }
}

export function describeEdit(edit: { tool: 'add' | 'remove' | 'goal'; kind: 'wall-maze' | 'terrain'; cell: CellCoord }): string {
  const position = `row ${edit.cell.row + 1}, column ${edit.cell.col + 1}`;
  if (edit.tool === 'goal') return `Goal moved to ${position}`;
  const action = edit.kind === 'wall-maze'
    ? edit.tool === 'add' ? 'Added walls' : 'Removed walls'
    : edit.tool === 'add' ? 'Raised cost' : 'Lowered cost';
  return `${action} around ${position}`;
}
