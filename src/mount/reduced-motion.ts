import type { Disposables } from './disposables';

export function trackReducedMotion(disposables: Disposables, changed: (reduced: boolean) => void): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false;
  const query = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = (): void => changed(query.matches);
  if (typeof query.addEventListener === 'function') disposables.listen(query, 'change', listener);
  else {
    query.addListener(listener);
    disposables.add(() => query.removeListener(listener));
  }
  return query.matches;
}
