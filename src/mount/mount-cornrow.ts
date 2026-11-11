import { Disposables } from './disposables';

/** Mount owns only its appended wrapper, never the host element. */
export function mountCornrow(element: HTMLElement): { destroy(): void } {
  const disposables = new Disposables();
  const wrapper = element.ownerDocument.createElement('div');
  wrapper.setAttribute('data-cornrow', '');
  wrapper.attachShadow({ mode: 'open' });
  element.append(wrapper);
  disposables.add(() => wrapper.remove());
  return { destroy: () => disposables.dispose() };
}
