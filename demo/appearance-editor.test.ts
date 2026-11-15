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
it('clears the live announcement when its own field is corrected but keeps another field\'s error', () => {
  const live = container.querySelector('[aria-live]')!;
  edit('Wall-maze frontier', 'text', '#12'); expect(live.textContent).not.toBe('');
  edit('Wall-maze frontier', 'text', '#a1b2c3'); expect(live.textContent).toBe('');
  edit('visited overlay', 'number', '101'); expect(live.textContent).not.toBe('');
  edit('visited overlay', 'number', '50'); expect(live.textContent).toBe('');
  edit('Wall-maze path', 'text', '#12'); const message = live.textContent;
  edit('Wall-maze frontier', 'text', '#123456'); expect(live.textContent).toBe(message);
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
it('keeps overlay hex and alpha errors independent until each draft is corrected', () => {
  const spy = vi.spyOn(handle, 'setAppearance');
  const overlay = row('visited overlay');
  const hex = overlay.querySelector<HTMLInputElement>('input[type=text]')!;
  const alpha = edit('visited overlay', 'number', '101');
  const errorFor = (node: HTMLInputElement) => container.querySelector('#' + node.getAttribute('aria-describedby'))!;
  const alphaMessage = errorFor(alpha).textContent;
  expect(alphaMessage).not.toBe('');
  expect(alpha.getAttribute('aria-invalid')).toBe('true');
  expect(hex.hasAttribute('aria-invalid')).toBe(false);
  expect(errorFor(hex).textContent).toBe('');
  expect(spy).not.toHaveBeenCalled();

  edit('visited overlay', 'color', '#123456');
  expect(alpha.getAttribute('aria-invalid')).toBe('true');
  expect(errorFor(alpha).textContent).toBe(alphaMessage);
  expect(spy).toHaveBeenLastCalledWith({ render: { palette: { visitedOverlay: { rgb: '#123456', alpha: .16 } } } });
  edit('visited overlay', 'text', '#12');
  const hexMessage = errorFor(hex).textContent;
  expect(hexMessage).not.toBe('');
  edit('visited overlay', 'number', '50');
  expect(alpha.hasAttribute('aria-invalid')).toBe(false);
  expect(errorFor(alpha).textContent).toBe('');
  expect(hex.value).toBe('#12');
  expect(hex.getAttribute('aria-invalid')).toBe('true');
  expect(errorFor(hex).textContent).toBe(hexMessage);
  expect(spy).toHaveBeenLastCalledWith({ render: { palette: { visitedOverlay: { rgb: '#123456', alpha: .5 } } } });
  edit('visited overlay', 'text', '#abcdef');
  expect(hex.hasAttribute('aria-invalid')).toBe(false);
  expect(errorFor(hex).textContent).toBe('');

  edit('visited overlay', 'number', '101');
  edit('visited overlay', 'text', '#12');
  container.querySelector('button')!.click();
  expect(container.querySelector('[aria-invalid=true]')).toBeNull();
  expect(errorFor(hex).textContent).toBe('');
  expect(errorFor(alpha).textContent).toBe('');
  expect(container.querySelector('[aria-live]')!.textContent).toBe('');
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

it('synchronises the active frontier base, preserves drafts and refreshes on environment changes', () => {
  const spy = vi.spyOn(handle, 'setAppearance');
  const hex = (label: string) => row(label).querySelector<HTMLInputElement>('input[type=text]')!.value;
  const base = () => container.querySelector('[data-preview="Base color"]')!.textContent;
  edit('Frontier base color', 'color', '#a1b2c3');
  expect(spy).toHaveBeenLastCalledWith({ render: { palette: { terrainMarkers: { frontier: '#A1B2C3' } } } });
  expect(base()).toBe('#A1B2C3');
  expect(hex('Terrain frontier marker')).toBe('#A1B2C3');
  const draft = edit('Frontier base color', 'text', '#12');
  expect(draft.value).toBe('#12'); expect(draft.getAttribute('aria-invalid')).toBe('true');
  expect(container.querySelector('[aria-live]')!.textContent).not.toBe('');
  edit('Frontier base color', 'text', '#123456');
  expect(draft.hasAttribute('aria-invalid')).toBe(false);
  expect(container.querySelector('[aria-live]')!.textContent).toBe('');
  edit('Terrain frontier marker', 'text', '#abcdef');
  expect(hex('Terrain frontier marker')).toBe('#abcdef');
  expect(hex('Frontier base color')).toBe('#ABCDEF'); expect(base()).toBe('#ABCDEF');
  edit('Frontier base color', 'text', '#654321'); expect(hex('Terrain frontier marker')).toBe('#654321');
  handle.generate({ environment: 'wall-maze' });
  expect(hex('Frontier base color')).toBe(hex('Wall-maze frontier'));
  edit('Wall-maze frontier', 'text', '#123456'); expect(hex('Frontier base color')).toBe('#123456');
  edit('Frontier base color', 'text', '#abcdef'); expect(hex('Wall-maze frontier')).toBe('#ABCDEF');
  input('input[type=range]', '150');
  expect(container.querySelector('[data-preview="Effective color"]')!.textContent).toBe(frontierColor('#ABCDEF' as typeof defaultAppearance.render.palette.frontier, 1.5));
  container.querySelector('button')!.click(); expect(hex('Frontier base color')).toBe(defaultAppearance.render.palette.frontier);
});

it('preserves unrelated color and alpha drafts when switching environments until explicitly reset', () => {
  const frontierDraft = edit('Frontier base color', 'text', '#12');
  const colorDraft = edit('Wall-maze path', 'text', '#34');
  const alphaDraft = edit('visited overlay', 'number', '101');
  const drafts = [colorDraft, alphaDraft];
  const errorFor = (node: HTMLInputElement) => container.querySelector('#' + node.getAttribute('aria-describedby'))!;
  const errors = drafts.map(node => errorFor(node).textContent);
  const live = container.querySelector('[aria-live]')!;
  const message = live.textContent;

  for (const environment of ['wall-maze', 'terrain'] as const) {
    handle.generate({ environment });
    expect(colorDraft.value).toBe('#34');
    expect(alphaDraft.value).toBe('101');
    drafts.forEach((node, i) => {
      expect(node.getAttribute('aria-invalid')).toBe('true');
      expect(errorFor(node).textContent).toBe(errors[i]);
    });
    expect(live.textContent).toBe(message);
    expect(frontierDraft.value).toBe(environment === 'wall-maze'
      ? defaultAppearance.render.palette.frontier : defaultAppearance.render.palette.terrainMarkers.frontier);
    expect(frontierDraft.hasAttribute('aria-invalid')).toBe(false);
  }

  container.querySelector('button')!.click();
  expect(colorDraft.value).toBe(defaultAppearance.render.palette.path);
  expect(alphaDraft.value).toBe('16');
  expect(container.querySelector('[aria-invalid=true]')).toBeNull();
  drafts.forEach(node => expect(errorFor(node).textContent).toBe(''));
  expect(live.textContent).toBe('');
});
