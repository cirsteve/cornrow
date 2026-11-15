// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { mountCornrow } from './mount-cornrow.js';
import { instrumentGlobals } from './test-support/instrument-globals.js';
import { computeLayout } from '../render/layout.js';
import { generateEnvironment } from '../generate/environment.js';
import { addObstacles, removeObstacles } from '../edit/edit-environment.js';

it('provides labelled tools, maps CSS clicks, announces edits and balances ownership', () => {
  const globals = instrumentGlobals();
  const host = document.createElement('div');
  const preserved = document.createElement('span'); host.append(preserved);
  const handle = mountCornrow(host, { seed: 'cornrow', rows: 10, cols: 10 });
  try {
    const root = host.lastElementChild?.shadowRoot;
    const canvas = root?.querySelector('canvas');
    const click = Array.from(root?.querySelectorAll('label') ?? []).find(l => l.firstChild?.textContent === 'Click')?.querySelector('select');
    const area = Array.from(root?.querySelectorAll('label') ?? []).find(l => l.firstChild?.textContent === 'Area')?.querySelector('input');
    if (!canvas || !click || !area) throw new Error('Missing editing controls');
    const status = () => root?.querySelector('[aria-live]')?.textContent;
    expect(Array.from(click.options).map(o => o.value)).toEqual(['none', 'add', 'remove', 'goal']);
    expect(Array.from(click.options).map(o => o.textContent)).toEqual(['None', 'Add walls', 'Remove walls', 'Move goal']);
    expect(click.value).toBe('none');
    expect([area.type, area.min, area.max, area.step, area.value]).toEqual(['number', '0', '5', '1', '1']);
    expect(globals.history.filter(r => r.target === canvas && r.type === 'click')).toHaveLength(1);
    let env = generateEnvironment({ kind: 'wall-maze', seed: 'cornrow', rows: 10, cols: 10 }).environment;
    let edits = 0;
    handle.on(event => { if (event.type === 'edited') { env = event.environment; edits++; } });
    const tap = (row: number, col: number) => {
      const layout = computeLayout(10, 10, { width: 480, height: 480 });
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new MouseEvent('click', { clientX: rect.left + layout.origin.x + (col + 0.5) * layout.cellSize, clientY: rect.top + layout.origin.y + (row + 0.5) * layout.cellSize }));
    };
    const choose = (tool: string) => { click.value = tool; click.dispatchEvent(new Event('change')); };
    const ready = status(); tap(2, 3); expect(edits).toBe(0); expect(status()).toBe(ready);
    choose('goal'); tap(0, 0); expect(edits).toBe(0); expect(status()).toBe(ready);
    tap(2, 3); expect(env.goal).toBe(23);
    expect(status()).toBe('Goal moved to row 3, column 4. Ready to solve with Breadth-first search');
    expect(canvas.getAttribute('aria-label')).toBe('Cornrow maze: 10 × 10 maze, edited from seed cornrow, Breadth-first search');
    const expectedAdd = addObstacles(env, { row: 4, col: 4 }, 1);
    choose('add'); tap(4, 4); expect(expectedAdd.ok && env.passages).toEqual(expectedAdd.ok && expectedAdd.value.passages);
    const expectedRemove = removeObstacles(env, { row: 4, col: 4 }, 1);
    choose('remove'); tap(4, 4); expect(expectedRemove.ok && env.passages).toEqual(expectedRemove.ok && expectedRemove.value.passages);
    const previous = env; const previousStatus = status();
    expect(handle.setGoal({ row: 0, col: 0 }).ok).toBe(false);
    expect(handle.addObstacles({ row: 99, col: 0 }).ok).toBe(false);
    expect(env).toBe(previous); expect(status()).toBe(previousStatus);
    handle.setEditRadius(9); expect(area.value).toBe('5');
    const wide = addObstacles(env, { row: 7, col: 7 }, 5);
    expect(handle.addObstacles({ row: 7, col: 7 }).ok).toBe(true);
    expect(wide.ok && env.passages).toEqual(wide.ok && wide.value.passages);
    area.value = '7'; area.dispatchEvent(new Event('input')); expect(area.value).toBe('5');
    handle.solve(); expect(status()).not.toContain('Added walls');
    expect(handle.setGoal({ row: 2, col: 3 }).ok).toBe(true);
    expect(handle.removeObstacles({ row: 4, col: 4 }).ok).toBe(true);
    handle.generate({}); expect(area.value).toBe('5'); expect(status()).toBe(ready);
    const environment = root?.querySelector<HTMLSelectElement>('select');
    const selector = Array.from(root?.querySelectorAll('label') ?? []).find(l => l.firstChild?.textContent === 'Environment')?.querySelector('select');
    if (!environment || !selector) throw new Error('Missing environment');
    selector.value = 'terrain'; selector.dispatchEvent(new Event('change'));
    expect(Array.from(click.options).map(o => o.textContent)).toEqual(['None', 'Raise cost', 'Lower cost', 'Move goal']);
    handle.destroy(); expect(host.firstChild).toBe(preserved); preserved.remove(); globals.assertBalanced(host);
    for (const operation of ['addObstacles', 'removeObstacles', 'setGoal'] as const) {
      expect(handle[operation]({ row: 2, col: 3 })).toMatchObject({ ok: false, error: { kind: 'destroyed', operation } });
    }
    handle.setEditRadius(2); expect(area.value).toBe('5');
  } finally { handle.destroy(); globals.restore(); }
});

it('ignores letterbox clicks and initially labels terrain tools', () => {
  const globals = instrumentGlobals(); const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'cornrow', rows: 5, cols: 10, environment: 'terrain' });
  try {
    const root = host.firstElementChild?.shadowRoot;
    const click = Array.from(root?.querySelectorAll('select') ?? []).find(s => s.options[0]?.value === 'none');
    const canvas = root?.querySelector('canvas');
    if (!click || !canvas) throw new Error('Missing controls');
    expect(click.options[1]?.textContent).toBe('Raise cost'); expect(click.options[2]?.textContent).toBe('Lower cost');
    click.value = 'goal'; click.dispatchEvent(new Event('change'));
    let edits = 0; handle.on(event => { if (event.type === 'edited') edits++; });
    const before = root?.querySelector('[aria-live]')?.textContent;
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 240, clientY: 1 }));
    expect(edits).toBe(0); expect(root?.querySelector('[aria-live]')?.textContent).toBe(before);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});
