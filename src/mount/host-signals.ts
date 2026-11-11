import type { Disposables } from './disposables.js';

interface HostSignalsOptions {
  readonly wrapper: HTMLElement;
  readonly disposables: Disposables;
  readonly suspend: (suspended: boolean) => void;
  readonly resize: () => void;
}

export function trackHostSignals({ wrapper, disposables, suspend, resize }: HostSignalsOptions): void {
  const document = wrapper.ownerDocument;
  const suspension = new Set<'offscreen' | 'hidden'>();
  function update(reason: 'offscreen' | 'hidden', active: boolean): void {
    if (active) suspension.add(reason);
    else suspension.delete(reason);
    suspend(suspension.size > 0);
  }
  const visibility = (): void => update('hidden', document.hidden);
  disposables.listen(document, 'visibilitychange', visibility);
  visibility();
  if (typeof globalThis.IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.target === wrapper) update('offscreen', !entry.isIntersecting);
    });
    disposables.add(() => observer.disconnect());
    observer.observe(wrapper);
  }
  if (typeof globalThis.ResizeObserver === 'function') {
    const observer = new ResizeObserver(resize);
    disposables.add(() => observer.disconnect());
    observer.observe(wrapper);
  }
}
