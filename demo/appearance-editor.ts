import { defaultAppearance, mergeAppearance, frontierColor, type AppearancePatch, type CornrowHandle } from '../src/index';
import { appearanceFields, pageDefaults, cssVariable } from './appearance-fields';
import { parseHexDraft, parsePercent, formatAlpha, colorValue, colorPatch, alphaPatch, shapePatch, saturationPatch, baseFrontier } from './appearance-drafts';

let nextEditor = 0;
interface EditorOptions { container: HTMLElement; handle: CornrowHandle; initialEnvironment: 'terrain' | 'wall-maze' }
export function createAppearanceEditor({ container, handle, initialEnvironment }: EditorOptions): { destroy(): void } {
  const prefix = `appearance-${++nextEditor}`;
  const root = container.closest<HTMLElement>('#demo') ?? container;
  const panel = document.createElement('section');
  panel.className = 'appearance-panel';
  const heading = document.createElement('h2'); heading.textContent = 'Appearance'; panel.append(heading);
  const disposers: (() => void)[] = [];
  const refreshers: (() => void)[] = [];
  let appearance = defaultAppearance;
  let pages: Record<keyof typeof pageDefaults, string> = { ...pageDefaults };
  let environment = initialEnvironment;
  function listen(target: EventTarget, event: string, listener: () => void) {
    target.addEventListener(event, listener);
    disposers.push(() => target.removeEventListener(event, listener));
  }
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, text = '') {
    const node = document.createElement(tag); node.textContent = text; parent.append(node); return node;
  }
  function fieldset(title: string) {
    const group = element('fieldset', panel); element('legend', group, title); return group;
  }
  const groups = { maze: fieldset('Maze colors'), terrain: fieldset('Terrain colors'), 'page-and-controls': fieldset('Page and controls') };
  const live = element('div', panel); live.setAttribute('aria-live', 'polite'); live.className = 'appearance-live';
  // The control whose error the live region shows; its correction clears the message, others' do not.
  let liveOwner: HTMLElement | null = null;
  function announce(owner: HTMLElement | null, detail: string) { liveOwner = owner; live.textContent = detail; }
  function settle(owner: HTMLElement) { if (liveOwner === owner) announce(null, ''); }
  function apply(patch: AppearancePatch): boolean {
    const merged = mergeAppearance(appearance, patch);
    if (!merged.ok) { announce(null, merged.error.detail); return false; }
    const applied = handle.setAppearance(patch);
    if (!applied.ok) { announce(null, applied.error.detail); return false; }
    appearance = merged.value; return true;
  }
  for (const [index, field] of appearanceFields.entries()) {
    const row = element('div', groups[field.group]); row.className = 'appearance-row';
    const label = element('label', row, field.label);
    const picker = element('input', row); picker.type = 'color'; picker.id = `${prefix}-${index}`;
    label.htmlFor = picker.id;
    const text = element('input', row); text.type = 'text'; text.setAttribute('aria-label', field.label + ' hex'); text.spellcheck = false;
    const swatch = element('span', row); swatch.className = 'appearance-swatch'; swatch.setAttribute('aria-hidden', 'true');
    const error = element('span', row); error.id = picker.id + '-error'; error.className = 'appearance-error';
    text.setAttribute('aria-describedby', error.id);
    function invalid(detail: string) { text.setAttribute('aria-invalid', 'true'); error.textContent = detail; announce(text, detail); }
    function clear() { text.removeAttribute('aria-invalid'); error.textContent = ''; settle(text); }
    function refresh() {
      const value = colorValue(appearance, field.path, pages);
      picker.value = value; text.value = value; swatch.style.backgroundColor = value; clear();
    }
    function commit(value: string) {
      const parsed = parseHexDraft(value);
      if (!parsed.ok) { invalid(parsed.error.detail); return; }
      const patch = colorPatch(appearance, field.path, parsed.value);
      if (patch && !apply(patch)) return;
      if (field.path.kind === 'page') pages[field.path.key] = parsed.value;
      if (field.path.kind === 'page' || field.path.kind === 'ui') root.style.setProperty(cssVariable(field.path.key), parsed.value);
      picker.value = parsed.value; swatch.style.backgroundColor = parsed.value; clear(); preview();
    }
    listen(picker, 'input', () => { text.value = picker.value.toUpperCase(); commit(text.value); });
    listen(text, 'input', () => commit(text.value));
    if (field.path.kind === 'overlay') {
      const path = field.path;
      const alphaLabel = element('label', row, field.label + ' alpha (%)');
      const alpha = element('input', row); alpha.type = 'number'; alpha.min = '0'; alpha.max = '100'; alpha.step = 'any';
      alpha.id = picker.id + '-alpha'; alphaLabel.htmlFor = alpha.id;
      const alphaError = element('span', row); alphaError.id = alpha.id + '-error'; alphaError.className = 'appearance-error';
      alpha.setAttribute('aria-describedby', alphaError.id);
      function clearAlpha() { alpha.removeAttribute('aria-invalid'); alphaError.textContent = ''; settle(alpha); }
      listen(alpha, 'input', () => {
        const parsed = parsePercent(alpha.value);
        if (!parsed.ok) {
          alpha.setAttribute('aria-invalid', 'true'); alphaError.textContent = parsed.error.detail; announce(alpha, parsed.error.detail); return;
        }
        if (apply(alphaPatch(appearance, path, parsed.value))) clearAlpha();
      });
      refreshers.push(() => { alpha.value = formatAlpha(appearance.render.palette[path.key].alpha); clearAlpha(); });
    }
    refreshers.push(refresh);
  }
  const frontier = fieldset('Frontier');
  const radios = (['square', 'circle'] as const).map(shape => {
    const label = element('label', frontier, shape === 'square' ? 'Square' : 'Circle');
    const radio = element('input', label); radio.type = 'radio'; radio.name = prefix + '-shape'; radio.value = shape;
    listen(radio, 'change', () => { if (radio.checked && apply(shapePatch(shape))) preview(); });
    return radio;
  });
  const sliderLabel = element('label', frontier, 'Frontier saturation');
  const slider = element('input', frontier); slider.type = 'range'; slider.min = '0'; slider.max = '200'; slider.step = '1'; slider.id = prefix + '-saturation'; sliderLabel.htmlFor = slider.id;
  const output = element('output', frontier); output.htmlFor = slider.id;
  element('p', frontier, "100% keeps the chosen color's saturation.").className = 'appearance-help';
  const samples = ['Base color', 'Effective color'].map(title => {
    const sample = element('div', frontier); element('span', sample, title);
    const swatch = element('span', sample); swatch.className = 'appearance-swatch'; swatch.setAttribute('aria-hidden', 'true');
    const hex = element('span', sample); hex.setAttribute('data-preview', title); return { swatch, hex };
  });
  function preview() {
    const base = baseFrontier(appearance, environment);
    const colors = [base, frontierColor(base, appearance.render.frontier.saturationScale)];
    samples.forEach(({ swatch, hex }, i) => {
      hex.textContent = colors[i] ?? ''; swatch.style.backgroundColor = colors[i] ?? '';
      swatch.style.borderRadius = appearance.render.frontier.shape === 'circle' ? '50%' : '0';
    });
    output.value = formatAlpha(appearance.render.frontier.saturationScale) + '%';
  }
  listen(slider, 'input', () => { if (apply(saturationPatch(Number(slider.value)))) preview(); });
  refreshers.push(() => {
    radios.forEach(radio => { radio.checked = radio.value === appearance.render.frontier.shape; });
    slider.value = formatAlpha(appearance.render.frontier.saturationScale); preview();
  });
  function rootVariables() {
    for (const [key, value] of Object.entries({ ...pages, ...appearance.ui })) root.style.setProperty(cssVariable(key), value);
  }
  const reset = element('button', panel, 'Reset appearance'); reset.type = 'button';
  listen(reset, 'click', () => {
    if (!apply(defaultAppearance)) return;
    pages = { ...pageDefaults }; rootVariables(); refreshers.forEach(refresh => refresh()); announce(null, '');
  });
  disposers.push(handle.on(event => { if (event.type === 'generated') { environment = event.generation.environment.kind; preview(); } }));
  rootVariables(); refreshers.forEach(refresh => refresh()); container.append(panel);
  let destroyed = false;
  return { destroy() {
    if (destroyed) return;
    destroyed = true; disposers.splice(0).forEach(dispose => dispose()); panel.remove(); handle.destroy();
  } };
}
