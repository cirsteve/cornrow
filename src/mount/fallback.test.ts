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
    expect(Array.from(root?.querySelectorAll('dt:not([hidden])') ?? []).map(term => term.textContent)).toEqual(['Seed', 'Size', 'Solver', 'Outcome', 'Path length', 'Explored count']);
    const values = () => Array.from(root?.querySelectorAll('dd:not([hidden])') ?? []).map(value => value.textContent);
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

it('keeps the cost row present and toggles both elements across environment changes', () => {
  const globals = instrumentGlobals({ contextAvailable: false });
  const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'cornrow', environment: 'terrain', rows: 5, cols: 5 });
  try {
    const root = host.firstElementChild?.shadowRoot;
    const term = Array.from(root?.querySelectorAll('dt') ?? []).find(term => term.textContent === 'Path cost');
    const value = term?.nextElementSibling as HTMLElement | null;
    if (!term || !value) throw new Error('Missing cost row');
    expect(term.hidden).toBe(false); expect(value.hidden).toBe(false);
    let finishedCost: number | null = null;
    handle.on(event => { if (event.type === 'solved') finishedCost = event.result.cost; });
    handle.solve(); expect(Number(value.textContent)).toBeGreaterThan(0);
    expect(value.textContent).toBe(String(finishedCost));
    handle.generate({ environment: 'wall-maze', seed: 'cornrow' });
    expect(term.hidden).toBe(true); expect(value.hidden).toBe(true);
    expect(root?.querySelectorAll('dt:not([hidden])')).toHaveLength(6);
    handle.generate({ environment: 'terrain', seed: 'cornrow' });
    expect(term.hidden).toBe(false); expect(value.hidden).toBe(false);
    expect(root?.querySelectorAll('dt:not([hidden])')).toHaveLength(7);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});
