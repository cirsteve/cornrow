// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
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
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 480, 480));
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
    area.value = ''; area.dispatchEvent(new Event('input')); expect(area.value).toBe('');
    area.value = '0'; area.dispatchEvent(new Event('input')); expect(area.value).toBe('0');
    area.value = ''; area.dispatchEvent(new Event('input')); area.dispatchEvent(new Event('change')); expect(area.value).toBe('0');
    handle.setEditRadius(5);
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
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 480, 480));
    expect(click.options[1]?.textContent).toBe('Raise cost'); expect(click.options[2]?.textContent).toBe('Lower cost');
    click.value = 'goal'; click.dispatchEvent(new Event('change'));
    let edits = 0; handle.on(event => { if (event.type === 'edited') edits++; });
    const before = root?.querySelector('[aria-live]')?.textContent;
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 240, clientY: 1 }));
    expect(edits).toBe(0); expect(root?.querySelector('[aria-live]')?.textContent).toBe(before);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it.each([0.5, 2])('maps clicks through a host scale of %s', scale => {
  const globals = instrumentGlobals(); const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'cornrow', rows: 10, cols: 10 });
  try {
    const root = host.firstElementChild?.shadowRoot;
    const canvas = root?.querySelector('canvas');
    const click = Array.from(root?.querySelectorAll('select') ?? []).find(s => s.options[0]?.value === 'none');
    if (!canvas || !click) throw new Error('Missing controls');
    let goal = -1; handle.on(event => { if (event.type === 'edited') goal = event.environment.goal; });
    click.value = 'goal'; click.dispatchEvent(new Event('change'));
    const layout = computeLayout(10, 10, { width: 480, height: 480 });
    const point = { x: layout.origin.x + 3.5 * layout.cellSize, y: layout.origin.y + 2.5 * layout.cellSize };
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 60, 480 * scale, 480 * scale));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40 + point.x * scale, clientY: 60 + point.y * scale }));
    expect(goal).toBe(23);
    goal = -1;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 60, 0, 0));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 60 }));
    expect(goal).toBe(-1);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it('accepts click coordinates from another window', () => {
  const globals = instrumentGlobals(); const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'cornrow', rows: 10, cols: 10 });
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  try {
    const root = host.firstElementChild?.shadowRoot;
    const canvas = root?.querySelector('canvas');
    const click = Array.from(root?.querySelectorAll('select') ?? []).find(s => s.options[0]?.value === 'none');
    if (!canvas || !click) throw new Error('Missing controls');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 480, 480));
    click.value = 'goal'; click.dispatchEvent(new Event('change'));
    let goal = -1; handle.on(event => { if (event.type === 'edited') goal = event.environment.goal; });
    const layout = computeLayout(10, 10, { width: 480, height: 480 });
    const iframeWindow = iframe.contentDocument?.defaultView;
    if (!iframeWindow) throw new Error('Missing iframe window');
    const event = new iframeWindow.MouseEvent('click', { clientX: layout.origin.x + 3.5 * layout.cellSize, clientY: layout.origin.y + 2.5 * layout.cellSize });
    // Happy-dom shares constructors across windows; model a distinct parent realm.
    vi.stubGlobal('MouseEvent', class ParentMouseEvent extends Event {});
    expect(event instanceof MouseEvent).toBe(false);
    canvas.dispatchEvent(event);
    expect(goal).toBe(23);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); iframe.remove(); }
});

it('applies a typed seed on Enter without relying on implicit form submission', () => {
  const globals = instrumentGlobals(); const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'cornrow' });
  try {
    const root = host.firstElementChild?.shadowRoot;
    const seed = root?.querySelector('input[type=text]');
    if (!(seed instanceof HTMLInputElement)) throw new Error('Missing seed');
    seed.value = 'entered-seed'; seed.focus();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    seed.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(root?.querySelector('canvas')?.getAttribute('aria-label')).toContain('seed entered-seed,');
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it.each([false, true])('continues finished edits with reduced motion %s and preserves paused intent', reducedMotion => {
  const globals = instrumentGlobals({ reducedMotion });
  const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'cornrow', rows: 10, cols: 10, stepsPerSecond: 500 });
  try {
    const root = host.firstElementChild?.shadowRoot;
    const status = () => root?.querySelector('[aria-live]')?.textContent ?? '';
    const states: string[] = [];
    let lastPath: readonly number[] = [];
    handle.on(event => {
      if (event.type === 'state-change') states.push(event.playback.kind);
      if (event.type === 'solved') lastPath = event.result.path;
    });
    handle.setGoal({ row: 0, col: 1 });
    expect(status()).toContain('Ready to solve');
    expect(globals.pendingFrames.size).toBe(0);
    handle.solve();
    for (let now = 0; globals.pendingFrames.size && now < 10000; now += 250) globals.frame(now);
    expect(states.at(-1)).toBe('finished');
    handle.setGoal({ row: 9, col: 9 });
    if (reducedMotion) {
      expect(states.at(-1)).toBe('finished');
      expect(lastPath.at(-1)).toBe(99);
      expect(globals.frameRequests).toBe(0);
    } else {
      expect(states.at(-1)).toBe('running');
      expect(globals.pendingFrames.size).toBe(1);
      expect(status()).toContain('; search continuing. Continuing search with');
      for (let now = 10000; globals.pendingFrames.size && now < 20000; now += 250) globals.frame(now);
      expect(states.at(-1)).toBe('finished');
      expect(lastPath.at(-1)).toBe(99);
      handle.solve(); globals.frame(20000); globals.frame(20010); handle.pause();
      handle.setGoal({ row: 2, col: 3 });
      expect(status()).toBe('Goal moved to row 3, column 4; search continuing. Paused continuing search with Breadth-first search');
      expect(globals.pendingFrames.size).toBe(0);
    }
    handle.reset(); expect(status()).not.toContain('search continuing');
    handle.solve(); expect(status()).not.toContain('search continuing');
    handle.generate(); expect(status()).not.toContain('search continuing');
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});
