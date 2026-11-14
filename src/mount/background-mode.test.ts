// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import type { ControllerEvent } from '../controller/controller';
import { mountCornrow } from './mount-cornrow';
import { instrumentGlobals } from './test-support/instrument-globals';

it('renders a decorative, noninteractive wrapper with no controls, status or focusable elements', () => {
  const globals = instrumentGlobals();
  const host = document.createElement('section');
  const handle = mountCornrow(host, { mode: 'background', rows: 5, cols: 5 });
  try {
    const wrapper = host.firstElementChild as HTMLElement;
    expect(wrapper.style.pointerEvents).toBe('none');
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper.shadowRoot?.querySelector('form, .terrain-legend, .status, [aria-live], button, input, select, a, [tabindex]')).toBeNull();
    expect(wrapper.shadowRoot?.querySelector('style')?.textContent).toContain(':host([data-mode=background]) { opacity: 0.35; }');
    expect(globals.pendingFrames.size).toBeGreaterThan(0);
    handle.destroy(); handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it('autoplays at 30 steps per second, holds the solution and regenerates with cycling solvers', () => {
  const globals = instrumentGlobals(); const host = document.createElement('div');
  const handle = mountCornrow(host, { mode: 'background', seed: 'cornrow', rows: 5, cols: 5 });
  try {
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    globals.frame(0); globals.frame(100); globals.frame(200);
    expect(events.filter(event => event.type === 'step')).toHaveLength(3);
    expect(events.find(event => event.type === 'solve-started')).toMatchObject({ solverId: 'bfs' });
    let now = 200;
    while (!events.some(event => event.type === 'solved') && now < 20000) globals.frame(now += 100);
    expect(events.filter(event => event.type === 'solved').at(-1)).toMatchObject({ result: { outcome: 'found' } });
    globals.frame(now += 100); // First hold frame establishes its timestamp.
    const holdStart = now;
    globals.frame(now += 2499);
    expect(events.some(event => event.type === 'generated')).toBe(false);
    globals.frame(now = holdStart + 2500);
    const generated = events.filter(event => event.type === 'generated');
    expect(generated).toHaveLength(1);
    expect(generated[0]?.generation.seed).not.toBe('cornrow');
    globals.frame(now += 100);
    expect(events.filter(event => event.type === 'solve-started').map(event => event.solverId)).toEqual(['bfs', 'dijkstra']);
    while (events.filter(event => event.type === 'solved').length < 2 && now < 40000) globals.frame(now += 100);
    expect(events.filter(event => event.type === 'solved')).toHaveLength(2);
    globals.frame(now += 100);
    globals.frame(now += 2500);
    globals.frame(now += 100);
    expect(events.filter(event => event.type === 'solve-started').map(event => event.solverId)).toEqual(['bfs', 'dijkstra', 'astar']);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it('suspends solving and hold time off-screen or hidden, and preserves explicit pause', () => {
  const globals = instrumentGlobals(); const host = document.createElement('div');
  const handle = mountCornrow(host, { mode: 'background', rows: 5, cols: 5, stepsPerSecond: 500 });
  try {
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    globals.intersect(false); expect(globals.pendingFrames.size).toBe(0);
    globals.visibility(true); globals.intersect(true); expect(globals.pendingFrames.size).toBe(0);
    globals.visibility(false); globals.frame(0); globals.frame(100);
    let now = 100;
    while (!events.some(event => event.type === 'solved') && now < 10000) globals.frame(now += 100);
    expect(events.some(event => event.type === 'solved')).toBe(true);
    globals.frame(now += 100); globals.frame(now += 1000);
    globals.intersect(false); expect(globals.pendingFrames.size).toBe(0);
    globals.intersect(true); globals.frame(100000);
    expect(events.some(event => event.type === 'generated')).toBe(false);
    globals.frame(101499); expect(events.some(event => event.type === 'generated')).toBe(false);
    globals.frame(101500); expect(events.some(event => event.type === 'generated')).toBe(true);
    handle.pause(); globals.visibility(true); globals.visibility(false);
    expect(globals.pendingFrames.size).toBe(0);
    handle.resume(); expect(globals.pendingFrames.size).toBeGreaterThan(0);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it('shows a static solved frame under live reduced motion, with no requested or pending frames', () => {
  const globals = instrumentGlobals({ reducedMotion: true }); const host = document.createElement('div');
  const handle = mountCornrow(host, { mode: 'background', seed: 'cornrow', rows: 5, cols: 5 });
  try {
    // The renderer draws a path using the canvas path API, and re-solving emits a found result.
    expect(globals.context.arc).toHaveBeenCalled();
    expect(globals.frameRequests).toBe(0);
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    handle.solve(); expect(events.at(-1)).toMatchObject({ type: 'solved', result: { outcome: 'found' } });
    expect(events.filter(event => event.type === 'step').at(-1)?.traceState.path?.length).toBeGreaterThan(0);
    expect(globals.frameRequests).toBe(0);
    globals.motion(false); globals.frame(0); globals.frame(100);
    expect(globals.pendingFrames.size).toBeGreaterThan(0);
    const requests = globals.frameRequests;
    globals.motion(true);
    expect(events.at(-1)).toMatchObject({ type: 'solved', result: { outcome: 'found' } });
    expect(globals.pendingFrames.size).toBe(0); expect(globals.frameRequests).toBe(requests);
    globals.motion(false); handle.pause(); globals.motion(true); globals.motion(false);
    expect(globals.pendingFrames.size).toBe(0);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it.each(['paused', 'off-screen', 'hidden'] as const)('defers a reduced-motion solve while %s until playback is allowed', reason => {
  const globals = instrumentGlobals(); const host = document.createElement('div');
  const handle = mountCornrow(host, { mode: 'background', seed: 'cornrow', rows: 5, cols: 5 });
  try {
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    globals.frame(0); globals.frame(100); globals.frame(200);
    expect(events.some(event => event.type === 'step')).toBe(true);
    expect(events.some(event => event.type === 'solved')).toBe(false);
    if (reason === 'paused') handle.pause();
    else if (reason === 'off-screen') globals.intersect(false);
    else globals.visibility(true);
    const eventCount = events.length;
    const requests = globals.frameRequests;

    globals.motion(true);
    expect(events).toHaveLength(eventCount);
    expect(globals.pendingFrames.size).toBe(0);
    expect(globals.frameRequests).toBe(requests);

    if (reason === 'paused') handle.resume();
    else if (reason === 'off-screen') globals.intersect(true);
    else globals.visibility(false);
    expect(events.at(-1)).toMatchObject({ type: 'solved', result: { outcome: 'found' } });
    expect(globals.pendingFrames.size).toBe(0);
    expect(globals.frameRequests).toBe(requests);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it('regenerates terrain on each background cycle and releases resources after switching environment', () => {
  const globals = instrumentGlobals(); const host = document.createElement('div');
  const handle = mountCornrow(host, { mode: 'background', environment: 'terrain', seed: 'cornrow', rows: 5, cols: 5, stepsPerSecond: 500 });
  try {
    expect(host.firstElementChild?.shadowRoot?.querySelector('.terrain-legend')).toBeNull();
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    let now = 0;
    while (events.filter(event => event.type === 'generated').length < 3 && now < 30000) globals.frame(now += 100);
    const generations = events.filter(event => event.type === 'generated');
    expect(generations).toHaveLength(3);
    expect(generations.every(event => event.generation.environment.kind === 'terrain')).toBe(true);
    handle.generate({ environment: 'wall-maze', seed: 'switch' });
    expect(events.filter(event => event.type === 'generated').at(-1)?.generation.environment.kind).toBe('wall-maze');
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});
