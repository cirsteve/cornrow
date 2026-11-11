// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { mountCornrow } from './mount-cornrow';
import { instrumentGlobals } from './test-support/instrument-globals';

it('hides a null-context canvas and updates a meaningful synchronous DOM summary', () => {
  const globals = instrumentGlobals({ contextAvailable: false }); const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'fallback', rows: 5, cols: 10 });
  try {
    const root = host.firstElementChild?.shadowRoot;
    expect(root?.querySelector('canvas')?.hidden).toBe(true);
    expect(root?.querySelector('dl')?.hidden).toBe(false);
    expect(Array.from(root?.querySelectorAll('dt') ?? []).map(term => term.textContent)).toEqual(['Seed', 'Size', 'Solver', 'Outcome', 'Path length', 'Explored count']);
    const values = () => Array.from(root?.querySelectorAll('dd') ?? []).map(value => value.textContent);
    expect(values()).toEqual(['fallback', '5 × 10', 'Breadth-first search', 'idle', '0', '0']);
    handle.solve();
    expect(values().slice(0, 4)).toEqual(['fallback', '5 × 10', 'Breadth-first search', 'found']);
    expect(Number(values()[4])).toBeGreaterThan(0); expect(Number(values()[5])).toBeGreaterThan(0);
    expect(root?.querySelector('[aria-live]')?.textContent).toContain('Found a path');
    handle.reset(); expect(values().slice(3)).toEqual(['idle', '0', '0']);
    handle.generate({ seed: 'new', rows: 10 }); expect(values().slice(0, 2)).toEqual(['new', '10 × 10']);
    expect(globals.frameRequests).toBe(0);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});
