/** Okabe–Ito hues with light exploration tints on a neutral background. */
export const palette = Object.freeze({
  background: '#FFFFFF', walls: '#222222', visited: '#B9DEEE', frontier: '#E69F00',
  path: '#0072B2', start: '#009E73', goal: '#CC79A7', current: '#000000',
  error: '#D55E00', failureVisited: '#F5D8CB', cancelled: '#DEDEDE',
  terrain: Object.freeze(['#EEF6F3', '#CDE4DC', '#ACD2C6', '#8BC0B0'] as const),
  visitedOverlay: 'rgba(0, 70, 110, 0.16)',
  failureVisitedOverlay: 'rgba(135, 59, 0, 0.16)',
  cancelledOverlay: 'rgba(0, 0, 0, 0.12)',
  // Operator-approved darker variants apply only to terrain; wall-maze hues stay intact.
  terrainMarkers: Object.freeze({
    path: '#00456B', frontier: '#684500', start: '#00553D', goal: '#703350',
    current: '#000000', error: '#7F3500',
  }),
});
