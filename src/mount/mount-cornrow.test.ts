// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { mountCornrow } from './mount-cornrow';
import { instrumentGlobals } from './test-support/instrument-globals';

it('mounts an isolated wrapper and destroys it idempotently without changing its host', () => {
  const globals = instrumentGlobals();
  const host = document.createElement('section');
  host.setAttribute('style', 'width: 600px');
  const attributes = host.outerHTML;
  try {
    const handle = mountCornrow(host);
    expect(host.querySelector('[data-cornrow]')?.shadowRoot).toBeTruthy();
    handle.destroy(); handle.destroy();
    globals.assertBalanced(host);
    expect(host.outerHTML).toBe(attributes);
  } finally { globals.restore(); }
});

import { afterEach, beforeEach, describe, vi } from 'vitest';
import type { CornrowHandle } from './mount-cornrow';
import type { ControllerEvent } from '../controller/controller';
import type { SolverId } from '../model/wall-maze';

describe('mounted controls and lifecycle', () => {
  let globals: ReturnType<typeof instrumentGlobals>;
  let host: HTMLElement;
  let handle: CornrowHandle;
  let root: ShadowRoot;
  function query<T extends Element>(selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  }
  function button(label: string): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll('button')).find(button => button.textContent === label);
    if (!found) throw new Error(`Missing ${label}`);
    return found;
  }
  beforeEach(() => {
    globals = instrumentGlobals(); host = document.createElement('section'); document.body.append(host);
    handle = mountCornrow(host, { seed: 'replay-me', rows: 10, cols: 10 });
    const shadow = host.firstElementChild?.shadowRoot;
    if (!shadow) throw new Error('Missing shadow root');
    root = shadow;
  });
  afterEach(() => {
    try { handle.destroy(); globals.assertBalanced(host); }
    finally { host.remove(); globals.restore(); }
  });

  it('draws its accessible first frame synchronously and keeps controls in native order', () => {
    expect(globals.context.stroke).toHaveBeenCalled();
    expect(globals.frameRequests).toBe(0);
    expect(query('canvas').getAttribute('role')).toBe('img');
    expect(query('canvas').getAttribute('aria-label')).toContain('10 × 10 maze, seed replay-me, Breadth-first search');
    expect(query('[aria-live]').getAttribute('aria-live')).toBe('polite');
    expect(Array.from(root.querySelectorAll('button,input,select')).map(element => element.tagName === 'BUTTON' ? element.textContent : element.closest('label')?.textContent?.split('10 ×')[0])).toEqual([
      'Generate', 'Solve', 'Pause', 'Reset', 'Speed', 'Size', 'AlgorithmBreadth-first searchA* (Manhattan)', 'Seed', 'Step',
    ]);
    expect(Array.from(query<HTMLSelectElement>('select').options).map(option => option.value)).toEqual(['10', '20', '30', '40', '60', '80']);
    expect(button('Pause').disabled).toBe(true);
    expect(button('Step').hidden).toBe(true);
    expect(root.querySelector('style')?.textContent).toContain('flex-wrap: wrap');
  });

  it('exercises all playback controls and releases active rAF and subscriptions on destroy', () => {
    const events: ControllerEvent[] = []; const listener = vi.fn((event: ControllerEvent) => events.push(event));
    const unsubscribe = handle.on(listener);
    button('Generate').click(); button('Solve').click();
    expect(globals.pendingFrames.size).toBe(1);
    globals.frame(0); globals.frame(250);
    expect(events.some(event => event.type === 'step')).toBe(true);
    button('Pause').click();
    expect(globals.pendingFrames.size).toBe(0);
    expect(button('Resume').getAttribute('aria-pressed')).toBe('true');
    button('Resume').click(); expect(globals.pendingFrames.size).toBe(1);
    button('Reset').click(); expect(globals.pendingFrames.size).toBe(0);
    expect(query('[aria-live]').textContent).toContain('Ready');
    unsubscribe(); unsubscribe(); listener.mockClear();
    handle.solve(); expect(listener).not.toHaveBeenCalled();
    handle.on(listener);
    handle.destroy(); handle.destroy();
    handle.generate(); handle.solve(); handle.pause(); handle.resume(); handle.reset(); handle.on(listener)();
    globals.frame(500);
    expect(listener).not.toHaveBeenCalled();
  });

  it('pauses for both host suspensions and never overrides explicit user pause', () => {
    handle.solve();
    globals.intersect(false); expect(globals.pendingFrames.size).toBe(0);
    globals.visibility(true); globals.intersect(true);
    expect(globals.pendingFrames.size).toBe(0);
    globals.visibility(false); expect(globals.pendingFrames.size).toBe(1);
    handle.pause(); globals.intersect(false); globals.intersect(true);
    globals.visibility(true); globals.visibility(false);
    expect(globals.pendingFrames.size).toBe(0);
    handle.resume(); expect(globals.pendingFrames.size).toBe(1);
    globals.intersect(false); handle.pause(); globals.intersect(true);
    expect(globals.pendingFrames.size).toBe(0);
  });

  it('does not request animation when Solve starts while suspended', () => {
    globals.visibility(true);
    handle.solve(); expect(globals.frameRequests).toBe(0);
    expect(query('[aria-live]').textContent).toContain('Paused');
    globals.visibility(false); expect(globals.pendingFrames.size).toBe(1);
  });

  it('generates fresh seeds but form submission replays the exact field seed', () => {
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    const seed = query<HTMLInputElement>('input[type=text]');
    button('Generate').click(); const fresh = seed.value;
    expect(fresh).not.toBe('replay-me'); expect(fresh.length).toBeGreaterThan(0);
    button('Generate').click(); expect(seed.value).not.toBe(fresh);
    seed.value = ' exact seed with spaces ';
    const event = new Event('submit', { cancelable: true }); query('form').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const generated = events.filter(event => event.type === 'generated');
    expect(generated.at(-1)?.generation.seed).toBe(' exact seed with spaces ');
    const first = generated.at(-1)?.generation.environment;
    query('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(events.filter(event => event.type === 'generated').at(-1)?.generation.environment).toEqual(first);
  });

  it.each([42, -1, 4294967297])('replays the shown topology for numeric seed %s on submit and size changes', seed => {
    handle.destroy();
    handle = mountCornrow(host, { seed, rows: 10, cols: 10 });
    const shadow = host.firstElementChild?.shadowRoot;
    if (!shadow) throw new Error('Missing shadow root');
    root = shadow;
    expect(query<HTMLInputElement>('input[type=text]').value).toBe(String(seed));
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    const clearWalls = (): void => {
      globals.context.moveTo.mockClear(); globals.context.lineTo.mockClear();
    };
    clearWalls(); globals.resize();
    const initialWalls = {
      starts: [...globals.context.moveTo.mock.calls], ends: [...globals.context.lineTo.mock.calls],
    };
    expect(initialWalls.starts.length).toBeGreaterThan(0);
    clearWalls(); query('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(globals.context.moveTo.mock.calls).toEqual(initialWalls.starts);
    expect(globals.context.lineTo.mock.calls).toEqual(initialWalls.ends);
    const replay = events.filter(event => event.type === 'generated').at(-1)?.generation;
    expect(replay?.seed).toBe(String(seed));
    const size = query<HTMLSelectElement>('select');
    size.value = '20'; size.dispatchEvent(new Event('change'));
    expect(events.filter(event => event.type === 'generated').at(-1)?.generation.seed).toBe(String(seed));
    clearWalls(); size.value = '10'; size.dispatchEvent(new Event('change'));
    expect(events.filter(event => event.type === 'generated').at(-1)?.generation).toEqual(replay);
    expect(globals.context.moveTo.mock.calls).toEqual(initialWalls.starts);
    expect(globals.context.lineTo.mock.calls).toEqual(initialWalls.ends);
  });

  it.each([[5, 5], [15, 15], [10, 20]])('shows current dimensions for a %s × %s mount and keeps square presets usable', (rows, cols) => {
    handle.destroy(); handle = mountCornrow(host, { seed: 'custom-size', rows, cols });
    const shadow = host.firstElementChild?.shadowRoot;
    if (!shadow) throw new Error('Missing shadow root');
    root = shadow;
    const size = query<HTMLSelectElement>('select');
    expect(size.selectedOptions[0]?.textContent).toBe(`${rows} × ${cols} (current)`);
    expect(size.selectedOptions[0]?.disabled).toBe(true);
    expect(Array.from(size.options).filter(option => !option.disabled).map(option => option.value))
      .toEqual(['10', '20', '30', '40', '60', '80']);
    handle.generate({ rows: 17, cols: 23, seed: 'custom-size' });
    expect(size.selectedOptions[0]?.textContent).toBe('17 × 23 (current)');
    expect(size.options).toHaveLength(7);
    query('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(size.selectedOptions[0]?.textContent).toBe('17 × 23 (current)');
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    size.value = '20'; size.dispatchEvent(new Event('change'));
    expect(size.selectedOptions[0]?.textContent).toBe('20 × 20');
    expect(size.options).toHaveLength(6);
    expect(events.filter(event => event.type === 'generated').at(-1)?.generation)
      .toMatchObject({ seed: 'custom-size', environment: { rows: 20, cols: 20 } });
  });

  it('applies size and speed immediately and selects the next solver', () => {
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    const size = query<HTMLSelectElement>('select'); size.value = '20'; size.dispatchEvent(new Event('change'));
    expect(events.filter(event => event.type === 'generated').at(-1)?.generation).toMatchObject({ seed: 'replay-me', environment: { rows: 20, cols: 20 } });
    // Label nesting means the algorithm is the second select, independent of CSS.
    const selected = root.querySelectorAll('select')[1];
    if (!selected) throw new Error('Missing algorithm');
    selected.value = 'astar'; selected.dispatchEvent(new Event('change'));
    const speed = query<HTMLInputElement>('input[type=range]'); speed.value = '8'; speed.dispatchEvent(new Event('input'));
    handle.solve(); globals.frame(0); globals.frame(250);
    expect(events.filter(event => event.type === 'step')).toHaveLength(2);
    expect(events.find(event => event.type === 'solve-started')).toMatchObject({ solverId: 'astar', solverLabel: 'A* (Manhattan)' });
    expect(query('canvas').getAttribute('aria-label')).toContain('A* (Manhattan)');
    handle.generate({ rows: -100, cols: Infinity, solver: 'missing' as SolverId, label: 'Guest maze' });
    expect(query('canvas').getAttribute('aria-label')).toContain('Guest maze: 5 × 80');
    handle.solve('missing' as SolverId);
    expect(events.filter(event => event.type === 'solve-started').at(-1)?.solverId).toBe('bfs');
  });

  it('resizes synchronously in CSS pixels at device pixel ratio', () => {
    vi.spyOn(host.firstElementChild as HTMLElement, 'getBoundingClientRect').mockReturnValue({ width: 320 } as DOMRect);
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    const draws = globals.context.stroke.mock.calls.length;
    globals.resize();
    const canvas = query<HTMLCanvasElement>('canvas');
    expect([canvas.width, canvas.height, canvas.style.width, canvas.style.height]).toEqual([640, 640, '320px', '320px']);
    expect(globals.context.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0);
    expect(globals.context.stroke.mock.calls.length).toBeGreaterThan(draws);
  });

  it('leaves wheel and touch scrolling uncancelled everywhere in the component', () => {
    for (const target of [query('canvas'), query('form'), host, document, window]) {
      for (const type of ['wheel', 'touchmove']) {
        const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
        target.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
      }
    }
  });

  it('mounts independently twice and preserves pre-existing host content', () => {
    const sibling = document.createElement('p'); sibling.textContent = 'Host content'; host.prepend(sibling);
    const second = mountCornrow(host, { seed: 'second' }); second.solve();
    handle.solve(); handle.destroy();
    expect(host.contains(sibling)).toBe(true);
    expect(globals.pendingFrames.size).toBe(1);
    second.destroy(); sibling.remove();
  });

  it('keeps a synchronous static/solved view when optional browser scheduling APIs are absent', () => {
    handle.destroy();
    for (const name of ['IntersectionObserver', 'ResizeObserver', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame']) vi.stubGlobal(name, undefined);
    handle = mountCornrow(host, { seed: 'static' });
    handle.solve();
    expect(globals.frameRequests).toBe(0);
    expect(host.firstElementChild?.shadowRoot?.querySelector('[aria-live]')?.textContent).toContain('Found a path');
  });
});
