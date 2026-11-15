// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { createTerrainLegend } from './legend.js';
import { defaultAppearance } from './appearance.js';
it('updates the same legend nodes without registrations or child changes', () => {
  const legend = createTerrainLegend(document);
  legend.update(defaultAppearance.render.palette.terrain, '#222222');
  const nodes = Array.from(legend.element.querySelectorAll('*'));
  for (let i = 0; i < 5; i++) legend.update(['#FFFFFF', '#EEEEEE', '#DDDDDD', '#CCCCCC'], '#FF0000');
  expect(Array.from(legend.element.querySelectorAll('*'))).toEqual(nodes);
  expect(legend.element.textContent).toBe('Cost 1 / 2 / 4 / 8');
  expect(legend.element.querySelector<HTMLElement>('.terrain-pip')?.style.backgroundColor).toBe('#FF0000');
});
