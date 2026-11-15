import { terrainPips } from '../render/draw-maze.js';

/** Uses the terrain palette by default and owns no browser registrations. */
export function createTerrainLegend(document: Document): { element: HTMLElement; update(bands: readonly [string, string, string, string], pip: string): void } {
  const legend = document.createElement('div');
  legend.className = 'terrain-legend';
  legend.setAttribute('role', 'group');
  legend.setAttribute('aria-label', 'Terrain costs');
  const swatches: HTMLElement[] = [];
  for (const band of [0, 1, 2, 3] as const) {
    const item = document.createElement('span'); item.className = 'terrain-legend-item';
    const swatch = document.createElement('span'); swatch.className = 'terrain-swatch';
    swatches.push(swatch); swatch.setAttribute('aria-hidden', 'true');
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
  return { element: legend, update(bands, pip) {
    swatches.forEach((swatch, band) => {
      swatch.style.backgroundColor = bands[band] ?? '';
      for (const child of Array.from(swatch.children)) (child as HTMLElement).style.backgroundColor = pip;
    });
  } };
}
