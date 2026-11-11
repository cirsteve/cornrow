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
