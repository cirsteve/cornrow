// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
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

import * as controllerModule from '../controller/controller.js';
import type { CornrowController } from '../controller/controller.js';

it('preserves exact controller snapshots and custom draws through lifecycle changes', () => {
  const globals = instrumentGlobals();
  const create = controllerModule.createController;
  let captured: CornrowController | undefined;
  vi.spyOn(controllerModule, 'createController').mockImplementation(options => {
    captured = create(options); return captured;
  });
  const rectColors: string[] = [], circleColors: string[] = [];
  const fillColor = () => (globals.context as unknown as { fillStyle: string }).fillStyle;
  globals.context.fillRect.mockImplementation(() => { rectColors.push(fillColor()); });
  globals.context.fill.mockImplementation(() => { circleColors.push(fillColor()); });
  const host = document.createElement('div');
  const handle = mountCornrow(host, { seed: 'appearance', rows: 10, cols: 10, environment: 'terrain',
    appearance: { ui: { text: '#123456' }, render: { palette: { background: '#010203', terrain: { 1: '#112233' }, terrainPip: '#334455' } } },
  });
  try {
    if (!captured) throw new Error('Controller not captured');
    const controller: CornrowController = captured;
    const wrapper = host.firstElementChild as HTMLElement;
    const root = wrapper.shadowRoot;
    if (!root) throw new Error('Missing root');
    const swatches = Array.from(root.querySelectorAll<HTMLElement>('.terrain-swatch'));
    const pips = Array.from(root.querySelectorAll<HTMLElement>('.terrain-pip'));
    expect(wrapper.style.getPropertyValue('--cornrow-text')).toBe('#123456');
    expect(swatches[1]?.style.backgroundColor).toBe('#112233');
    expect(pips.length).toBeGreaterThan(0);
    expect(pips.every(pip => pip.style.backgroundColor === '#334455')).toBe(true);
    expect(rectColors).toContain('#112233'); expect(circleColors).toContain('#334455');
    let eventCount = 0; handle.on(() => { eventCount++; });
    function editAndCheck(): void {
      const before = controller.getSnapshot();
      const events = eventCount, frames = globals.frameRequests, pending = globals.pendingFrames.size;
      rectColors.length = 0; circleColors.length = 0;
      expect(handle.setAppearance({ render: { palette: { background: '#020304', terrain: { 1: '#445566' }, terrainPip: '#556677', visitedOverlay: { rgb: '#123456', alpha: 0.37 } } } }).ok).toBe(true);
      const after = controller.getSnapshot();
      expect(after).toEqual(before);
      expect(after.generation).toBe(before.generation);
      expect(after.traceState).toBe(before.traceState);
      expect(after.playback).toBe(before.playback);
      expect(after.selectedSolver).toBe(before.selectedSolver);
      expect(eventCount).toBe(events);
      expect(globals.frameRequests).toBe(frames); expect(globals.pendingFrames.size).toBe(pending);
      expect(rectColors[0]).toBe('#020304');
      expect(swatches[1]?.style.backgroundColor).toBe('#445566');
      expect(pips.every(pip => pip.style.backgroundColor === '#556677')).toBe(true);
      if (after.generation.environment.kind === 'terrain') {
        expect(rectColors).toContain('#445566'); expect(circleColors).toContain('#556677');
      }
    }
    handle.solve(); editAndCheck();
    rectColors.length = 0; globals.frame(0); globals.frame(200);
    expect(rectColors).toContain('#020304'); handle.pause();
    expect(controller.getSnapshot().playback.kind).toBe('paused');
    // Ensure this assertion exercises an explored cell, rather than only a redraw.
    expect(controller.getSnapshot().traceState.visited.size).toBeGreaterThan(0);
    editAndCheck();
    expect(rectColors).toContain('rgba(18, 52, 86, 0.37)');
    globals.intersect(false); editAndCheck(); globals.intersect(true);
    globals.motion(true); handle.solve();
    expect(controller.getSnapshot().playback.kind).toBe('finished'); editAndCheck();
    controller.replay(); editAndCheck(); handle.pause();
    handle.generate({ seed: 'again' }); editAndCheck();
    handle.reset(); editAndCheck();
    const algorithm = Array.from(root.querySelectorAll('select')).find(select => Array.from(select.options).some(option => option.value === 'astar'));
    if (!algorithm) throw new Error('Missing algorithm select');
    algorithm.value = 'astar'; algorithm.dispatchEvent(new Event('change'));
    handle.solve(); expect(controller.getSnapshot().selectedSolver).toBe('astar'); editAndCheck();
    const environment = Array.from(root.querySelectorAll('select')).find(select => Array.from(select.options).some(option => option.value === 'terrain'));
    if (!environment) throw new Error('Missing environment select');
    environment.value = 'wall-maze'; environment.dispatchEvent(new Event('change'));
    expect(controller.getSnapshot().generation.environment.kind).toBe('wall-maze'); editAndCheck();
    environment.value = 'terrain'; environment.dispatchEvent(new Event('change')); editAndCheck();
    rectColors.length = 0; globals.resize();
    expect(rectColors).toContain('#020304');
    expect(Array.from(root.querySelectorAll('.terrain-swatch'))).toEqual(swatches);
    expect(Array.from(root.querySelectorAll('.terrain-pip'))).toEqual(pips);
  } finally { handle.destroy(); globals.assertBalanced(host); globals.restore(); }
});

it('updates fallback text variables without a canvas', () => {
  const globals = instrumentGlobals({ contextAvailable: false });
  const host = document.createElement('div');
  const handle = mountCornrow(host);
  try {
    const wrapper = host.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue('--cornrow-fallback-text')).toBe('#172B21');
    expect(handle.setAppearance({ ui: { fallbackText: '#654321' } }).ok).toBe(true);
    expect(wrapper.style.getPropertyValue('--cornrow-fallback-text')).toBe('#654321');
    const summary = wrapper.shadowRoot?.querySelector<HTMLElement>('.fallback-summary');
    expect(summary).not.toBeNull(); expect(summary?.hidden).toBe(false);
  } finally { handle.destroy(); globals.assertBalanced(host); globals.restore(); }
});
