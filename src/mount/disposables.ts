import type { FrameScheduler } from '../controller/frame-scheduler';

/** Owns registrations; early release also removes them from the collector. */
export class Disposables {
  private readonly releases = new Set<() => void>();
  private disposed = false;

  add(cleanup: () => void): () => void {
    let active = true;
    const release = (): void => {
      if (!active) return;
      active = false;
      this.releases.delete(release);
      cleanup();
    };
    if (this.disposed) release();
    else this.releases.add(release);
    return release;
  }

  listen(target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions): () => void {
    target.addEventListener(type, listener, options);
    return this.add(() => target.removeEventListener(type, listener, options));
  }

  scheduler(source: FrameScheduler): FrameScheduler {
    const pending = new Map<number, () => void>();
    return {
      request: callback => {
        let completed = false;
        const handle = source.request(now => {
          completed = true;
          pending.get(handle)?.();
          callback(now);
        });
        pending.set(handle, this.add(() => {
          pending.delete(handle);
          if (!completed) source.cancel(handle);
        }));
        return handle;
      },
      cancel: handle => { pending.get(handle)?.(); },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const release of [...this.releases].reverse()) release();
  }
}
