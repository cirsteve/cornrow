import { terrainPips } from '../render/draw-maze.js';
import { palette } from '../render/palette.js';

/** Uses the terrain palette by default and owns no browser registrations. */
export function createTerrainLegend(document: Document, bands: readonly [string, string, string, string] = palette.terrain): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'terrain-legend';
  legend.setAttribute('role', 'group');
  legend.setAttribute('aria-label', 'Terrain costs');
  for (const band of [0, 1, 2, 3] as const) {
    const item = document.createElement('span'); item.className = 'terrain-legend-item';
    const swatch = document.createElement('span'); swatch.className = 'terrain-swatch';
    swatch.style.backgroundColor = bands[band]; swatch.setAttribute('aria-hidden', 'true');
    for (const { center, radius } of terrainPips(band)) {
      const pip = document.createElement('span'); pip.className = 'terrain-pip';
      pip.style.left = `${(center.x - radius) * 100}%`;
      pip.style.top = `${(center.y - radius) * 100}%`;
      pip.style.width = `${radius * 200}%`; pip.style.height = `${radius * 200}%`;
      swatch.append(pip);
    }
    if (band > 0) item.append(document.createTextNode(' / '));
    item.append(swatch, document.createTextNode(`${band === 0 ? 'Cost ' : ''}${2 ** band}`));
    legend.append(item);
  }
  return legend;
}
