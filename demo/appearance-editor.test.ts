// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultAppearance, mountCornrow, frontierColor } from '../src/index';
import { instrumentGlobals } from '../src/mount/test-support/instrument-globals';
import { createAppearanceEditor } from './appearance-editor';
import { appearanceFields, pageDefaults } from './appearance-fields';
import { colorValue } from './appearance-drafts';

let globals: ReturnType<typeof instrumentGlobals>;
let host: HTMLDivElement;
let container: HTMLDivElement;
let handle: ReturnType<typeof mountCornrow>;
let editor: ReturnType<typeof createAppearanceEditor>;
beforeEach(() => {
  globals = instrumentGlobals();
  const root = document.createElement('main'); root.id = 'demo'; document.body.append(root);
  host = document.createElement('div'); container = document.createElement('div'); root.append(host, container);
  handle = mountCornrow(host, { environment: 'terrain', rows: 5, cols: 5, seed: 'editor' });
  editor = createAppearanceEditor({ container, handle, initialEnvironment: 'terrain' });
});
afterEach(() => { editor.destroy(); globals.assertBalanced(host); globals.restore(); document.body.replaceChildren(); });
function input(selector: string, value: string) {
  const node = container.querySelector<HTMLInputElement>(selector)!; node.value = value;
  node.dispatchEvent(new Event('input', { bubbles: true })); return node;
}
function row(label: string) {
  return Array.from(container.querySelectorAll('.appearance-row')).find(row => row.querySelector('label')?.textContent === label)!;
}
function edit(label: string, type: string, value: string) {
  const node = row(label).querySelector<HTMLInputElement>(`input[type=${type}]`)!;
  node.value = value; node.dispatchEvent(new Event('input')); return node;
}
it('commits picker and valid hex while retaining invalid drafts and announcing errors', () => {
  const spy = vi.spyOn(handle, 'setAppearance');
  edit('Wall-maze frontier', 'color', '#a1b2c3');
  expect(spy).toHaveBeenLastCalledWith({ render: { palette: { frontier: '#A1B2C3' } } });
  expect(row('Wall-maze frontier').querySelector<HTMLInputElement>('input[type=text]')!.value).toBe('#A1B2C3');
  spy.mockClear();
  const draft = edit('Wall-maze frontier', 'text', '#12');
  expect(draft.value).toBe('#12'); expect(draft.getAttribute('aria-invalid')).toBe('true'); expect(spy).not.toHaveBeenCalled();
  expect(container.querySelector('#' + draft.getAttribute('aria-describedby'))!.textContent).not.toBe('');
  const live = container.querySelector('[aria-live]')!; const message = live.textContent;
  input('input[type=range]', '0'); expect(live.textContent).toBe(message);
  edit('Wall-maze frontier', 'text', '#a1b2c3'); expect(draft.hasAttribute('aria-invalid')).toBe(false);
});
it('preserves overlay channels, isolates terrain bands, and applies root tokens', () => {
  const spy = vi.spyOn(handle, 'setAppearance');
  edit('visited overlay', 'color', '#123456');
  expect(spy).toHaveBeenLastCalledWith({ render: { palette: { visitedOverlay: { rgb: '#123456', alpha: .16 } } } });
  edit('visited overlay', 'number', '50');
  expect(spy).toHaveBeenLastCalledWith({ render: { palette: { visitedOverlay: { rgb: '#123456', alpha: .5 } } } });
  edit('Cost 2', 'color', '#123456'); expect(spy).toHaveBeenLastCalledWith({ render: { palette: { terrain: { 1: '#123456' } } } });
  spy.mockClear(); edit('page background', 'color', '#123456'); expect(spy).not.toHaveBeenCalled();
  expect(container.parentElement!.style.getPropertyValue('--demo-page-background')).toBe('#123456');
  edit('control accent', 'color', '#123456'); expect(spy).toHaveBeenLastCalledWith({ ui: { controlAccent: '#123456' } });
  expect(container.parentElement!.style.getPropertyValue('--demo-control-accent')).toBe('#123456');
});
it('previews saturation, shape and active environment from stored base colors', () => {
  const spy = vi.spyOn(handle, 'setAppearance');
  const base = () => container.querySelector('[data-preview="Base color"]')!.textContent;
  const effective = () => container.querySelector('[data-preview="Effective color"]')!.textContent;
  expect(base()).toBe('#684500');
  for (const n of [0, 100, 200]) {
    input('input[type=range]', String(n)); expect(container.querySelector('output')!.value).toBe(n + '%');
    expect(spy).toHaveBeenLastCalledWith({ render: { frontier: { saturationScale: n / 100 } } });
    expect(effective()).toBe(frontierColor(defaultAppearance.render.palette.terrainMarkers.frontier, n / 100));
  }
  const circle = container.querySelector<HTMLInputElement>('input[value=circle]')!; circle.checked = true; circle.dispatchEvent(new Event('change'));
  expect(spy).toHaveBeenLastCalledWith({ render: { frontier: { shape: 'circle' } } });
  expect(container.querySelector<HTMLElement>('[data-preview]')!.previousElementSibling!.getAttribute('style')).toContain('50%');
  handle.generate({ environment: 'wall-maze' }); expect(base()).toBe('#E69F00');
  input('input[type=range]', '150'); edit('Wall-maze frontier', 'color', '#a1b2c3');
  expect(effective()).toBe(frontierColor('#A1B2C3' as typeof defaultAppearance.render.palette.frontier, 1.5));
  expect(container.querySelector<HTMLInputElement>('input[type=range]')!.value).toBe('150'); expect(container.querySelector('canvas')).toBeNull();
});
it('resets all fields without changing playback and destroys all registrations', () => {
  edit('visited overlay', 'number', '50'); edit('Wall-maze frontier', 'text', '#12'); input('input[type=range]', '200');
  const appearance = vi.spyOn(handle, 'setAppearance'); appearance.mockClear();
  const playback = [vi.spyOn(handle, 'generate'), vi.spyOn(handle, 'solve'), vi.spyOn(handle, 'reset')];
  container.querySelector('button')!.click(); expect(appearance).toHaveBeenCalledExactlyOnceWith(defaultAppearance);
  for (const field of appearanceFields) expect(row(field.label).querySelector<HTMLInputElement>('input[type=text]')!.value).toBe(colorValue(defaultAppearance, field.path, pageDefaults));
  expect(Array.from(container.querySelectorAll<HTMLInputElement>('input[type=number]')).map(n => n.value)).toEqual(['16', '16', '12']);
  expect(container.querySelector('[aria-invalid=true]')).toBeNull(); expect(container.querySelector('[aria-live]')!.textContent).toBe('');
  expect(container.querySelector<HTMLInputElement>('input[value=square]')!.checked).toBe(true);
  expect(container.querySelector('output')!.value).toBe('100%'); playback.forEach(spy => expect(spy).not.toHaveBeenCalled());
  editor.destroy(); expect(container.childNodes.length).toBe(0); expect(handle.setAppearance({}).ok).toBe(false);
});
