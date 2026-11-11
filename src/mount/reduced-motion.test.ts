// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import type { ControllerEvent } from '../controller/controller';
import { mountCornrow } from './mount-cornrow';
import { instrumentGlobals } from './test-support/instrument-globals';

it('solves immediately under reduced motion and steps the same recorded solve from an empty trace', () => {
  const globals = instrumentGlobals({ reducedMotion: true });
  const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'steps', rows: 5, cols: 5 });
  try {
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    handle.solve();
    expect(events.at(-1)?.type).toBe('solved');
    expect(host.firstElementChild?.shadowRoot?.querySelector('[aria-live]')?.textContent).toContain('Found a path');
    expect(globals.frameRequests).toBe(0);
    const recorded = events.filter(event => event.type === 'step');
    expect(recorded.at(-1)?.traceState.path?.length).toBeGreaterThan(0);
    const step = Array.from(host.firstElementChild?.shadowRoot?.querySelectorAll('button') ?? []).find(button => button.textContent === 'Step');
    if (!step) throw new Error('Missing Step');
    expect(step.hidden).toBe(false);
    events.length = 0;
    step.click();
    const first = events.filter(event => event.type === 'step');
    expect(first).toHaveLength(1); expect(first[0]?.event).toEqual(recorded[0]?.event);
    expect(first[0]?.traceState.path).toBeNull();
    expect(first[0]?.traceState.visited.size).toBeLessThanOrEqual(1);
    events.length = 0; step.click();
    expect(events.filter(event => event.type === 'step').map(event => event.event)).toEqual([recorded[1]?.event]);
    expect(globals.frameRequests).toBe(0);
    expect(globals.mediaListenerCount).toBe(1);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it('tracks live changes, cancels a pending frame, and preserves explicit user pause', () => {
  const globals = instrumentGlobals(); const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'motion' });
  try {
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    handle.solve(); expect(globals.pendingFrames.size).toBe(1);
    globals.motion(true); expect(globals.pendingFrames.size).toBe(0);
    const frames = globals.frameRequests;
    handle.solve(); expect(events.at(-1)?.type).toBe('solved');
    expect(globals.frameRequests).toBe(frames);
    globals.motion(false); handle.solve(); expect(globals.pendingFrames.size).toBe(1);
    handle.pause(); globals.motion(true); globals.motion(false);
    expect(globals.pendingFrames.size).toBe(0);
    handle.resume(); expect(globals.pendingFrames.size).toBe(1);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it('Step starts the selected solver before any Solve has run', () => {
  const globals = instrumentGlobals({ reducedMotion: true }); const host = document.createElement('div');
  const handle = mountCornrow(host, { solver: 'astar' as import('../model/wall-maze').SolverId });
  try {
    const events: ControllerEvent[] = []; handle.on(event => events.push(event));
    const step = Array.from(host.firstElementChild?.shadowRoot?.querySelectorAll('button') ?? []).find(button => button.textContent === 'Step');
    step?.click();
    expect(events.find(event => event.type === 'solve-started')).toMatchObject({ solverId: 'astar' });
    expect(events.filter(event => event.type === 'step')).toHaveLength(1);
    expect(globals.frameRequests).toBe(0);
    handle.destroy(); globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});
