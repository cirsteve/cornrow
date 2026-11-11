import type { ControllerSnapshot } from '../controller/controller.js';

export function createFallbackSummary(document: Document) {
  const element = document.createElement('dl');
  element.setAttribute('aria-label', 'Maze summary');
  const entries = ['Seed', 'Size', 'Solver', 'Outcome', 'Path length', 'Explored count'].map(label => {
    const term = document.createElement('dt'); term.textContent = label;
    const value = document.createElement('dd'); element.append(term, value);
    return value;
  });
  return {
    element,
    update(snapshot: ControllerSnapshot, solverLabel: string): void {
      const { generation, playback, traceState } = snapshot;
      const values = [String(generation.seed), `${generation.environment.rows} × ${generation.environment.cols}`, solverLabel,
        playback.kind === 'finished' ? playback.outcome : playback.kind,
        String(playback.kind === 'finished' ? playback.pathLength : traceState.path?.length ?? 0),
        String(playback.kind === 'finished' ? playback.exploredCount : traceState.visited.size)];
      entries.forEach((entry, index) => { entry.textContent = values[index] ?? ''; });
    },
  };
}
