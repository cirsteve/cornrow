import type { CellCoord } from '../model/wall-maze.js';
import type { PlaybackState } from '../controller/playback-state.js';

export function describeOutcome(playback: PlaybackState, solverLabel: string, environmentKind: 'wall-maze' | 'terrain', continuing = false): string {
  switch (playback.kind) {
    case 'idle': return `Ready to solve with ${solverLabel}`;
    case 'running': return `${continuing ? 'Continuing search' : 'Solving'} with ${playback.solverLabel}`;
    case 'paused': return `Paused${continuing ? ' continuing search' : ''} with ${playback.solverLabel}`;
    case 'finished':
      switch (playback.outcome) {
        case 'found': return `Found a path of ${playback.pathLength} cells${environmentKind === 'terrain' ? ` (cost ${playback.pathCost})` : ''} after exploring ${playback.exploredCount} cells with ${solverLabel}`;
        case 'unreachable': return `Goal unreachable after exploring ${playback.exploredCount} cells`;
        case 'cancelled': return `Solve cancelled after exploring ${playback.exploredCount} cells`;
      }
  }
}

export function describeEdit(edit: { tool: 'add' | 'remove' | 'goal'; kind: 'wall-maze' | 'terrain'; cell: CellCoord; continuing: boolean }): string {
  const position = `row ${edit.cell.row + 1}, column ${edit.cell.col + 1}`;
  const suffix = edit.continuing ? '; search continuing' : '';
  if (edit.tool === 'goal') return `Goal moved to ${position}${suffix}`;
  const action = edit.kind === 'wall-maze'
    ? edit.tool === 'add' ? 'Added walls' : 'Removed walls'
    : edit.tool === 'add' ? 'Raised cost' : 'Lowered cost';
  return `${action} around ${position}${suffix}`;
}
