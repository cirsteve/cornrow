// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { mountCornrow } from './mount-cornrow.js';
import { instrumentGlobals } from './test-support/instrument-globals.js';
import { defaultAppearance } from './appearance.js';

it.each([true, false])('updates instance appearance without scheduling or events, canvas=%s', contextAvailable => {
  const globals = instrumentGlobals({ contextAvailable });
  const host = document.createElement('div');
  const handle = mountCornrow(host, { environment: 'terrain', seed: 'appearance' });
  const wrapper = host.firstElementChild as HTMLElement;
  let events = 0;
  handle.on(() => { events++; });
  try {
    const legendNodes = Array.from(wrapper.shadowRoot?.querySelectorAll('.terrain-legend *') ?? []);
    for (const change of [() => {}, () => globals.intersect(false), () => globals.motion(true)]) {
      change();
      const frames = globals.frameRequests, pending = globals.pendingFrames.size, count = events;
      const paints = globals.context.fillRect.mock.calls.length;
      expect(handle.setAppearance({ render: { palette: { background: '#010203', terrain: { 1: '#00FF00' }, terrainPip: '#FF0000' } }, ui: { text: '#123456' } })).toEqual({ ok: true, value: undefined });
      expect(wrapper.style.getPropertyValue('--cornrow-text')).toBe('#123456');
      expect(globals.frameRequests).toBe(frames); expect(globals.pendingFrames.size).toBe(pending); expect(events).toBe(count);
      if (contextAvailable) expect(globals.context.fillRect.mock.calls.length).toBeGreaterThan(paints);
    }
    const paints = globals.context.fillRect.mock.calls.length;
    expect(handle.setAppearance({ ui: { text: 'invalid' } }).ok).toBe(false);
    expect(globals.context.fillRect.mock.calls.length).toBe(paints);
    handle.generate(); handle.reset(); globals.resize();
    expect(wrapper.style.getPropertyValue('--cornrow-text')).toBe('#123456');
    expect(Array.from(wrapper.shadowRoot?.querySelectorAll('.terrain-legend *') ?? [])).toEqual(legendNodes);
    expect(defaultAppearance.ui.text).toBe('#172B21');
    if (!contextAvailable) expect(wrapper.shadowRoot?.querySelector('.fallback-summary')?.hasAttribute('hidden')).toBe(false);
    handle.destroy();
    expect(handle.setAppearance({})).toMatchObject({ ok: false, error: { kind: 'destroyed', operation: 'setAppearance' } });
    globals.assertBalanced(host);
  } finally { handle.destroy(); globals.restore(); }
});

it('retains running playback and isolates mounts', () => {
  const globals = instrumentGlobals();
  const host = document.createElement('div'), other = document.createElement('div');
  const first = mountCornrow(host, { seed: 'run', rows: 10, cols: 10 });
  const second = mountCornrow(other, { appearance: { ui: { text: 'nope' } } });
  try {
    first.solve(); globals.frame(0); globals.frame(20);
    const pending = globals.pendingFrames.size, requested = globals.frameRequests;
    let events = 0; first.on(() => { events++; });
    expect(first.setAppearance({ ui: { text: '#FF0000' } }).ok).toBe(true);
    expect(events).toBe(0);
    expect(globals.pendingFrames.size).toBe(pending);
    expect(globals.frameRequests).toBe(requested);
    expect((other.firstElementChild as HTMLElement).style.getPropertyValue('--cornrow-text')).toBe('#172B21');
    globals.frame(200);
    expect(events).toBeGreaterThan(0);
  } finally {
    first.destroy(); second.destroy();
    globals.assertBalanced(host); globals.assertBalanced(other); globals.restore();
  }
});
