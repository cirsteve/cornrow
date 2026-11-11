import { expect, vi } from 'vitest';

type RegisteredListener = EventListenerOrEventListenerObject | null;
interface Registration {
  target: EventTarget;
  type: string;
  listener: RegisteredListener;
  capture: boolean;
}
interface ObserverRegistration { target: Element; callback: () => void }

/** Exact registration accounting around a happy-dom mount, with controllable host signals. */
export function instrumentGlobals({ contextAvailable = true, reducedMotion = false } = {}) {
  const registrations: Registration[] = [];
  const history: Registration[] = [];
  const pendingFrames = new Map<number, FrameRequestCallback>();
  const intersections = new Set<ObserverRegistration>();
  const resizes = new Set<ObserverRegistration>();
  const mediaListeners = new Set<EventListenerOrEventListenerObject>();
  let nextFrame = 0;
  let frameRequests = 0;
  let onScreen = true;
  let reduced = reducedMotion;
  const head = document.head.innerHTML;
  const sheets = document.styleSheets.length;
  const captureOf = (options?: boolean | EventListenerOptions): boolean => typeof options === 'boolean' ? options : options?.capture ?? false;
  // Cover globals, root and created elements (including shadow roots). Dedupe
  // records when an implementation delegates through another wrapped prototype.
  for (const target of [EventTarget.prototype, HTMLElement.prototype, ShadowRoot.prototype, window, document, document.documentElement]) {
    const add = target.addEventListener;
    const remove = target.removeEventListener;
    vi.spyOn(target, 'addEventListener').mockImplementation(function (this: EventTarget, type: string, listener: RegisteredListener, options?: boolean | AddEventListenerOptions) {
      const capture = captureOf(options);
      if (listener && !registrations.some(r => r.target === this && r.type === type && r.listener === listener && r.capture === capture)) {
        const record = { target: this, type, listener, capture };
        registrations.push(record); history.push(record);
      }
      if (listener) add.call(this, type, listener, options);
    });
    vi.spyOn(target, 'removeEventListener').mockImplementation(function (this: EventTarget, type: string, listener: RegisteredListener, options?: boolean | EventListenerOptions) {
      const index = registrations.findIndex(r => r.target === this && r.type === type && r.listener === listener && r.capture === captureOf(options));
      if (index >= 0) registrations.splice(index, 1);
      if (listener) remove.call(this, type, listener, options);
    });
  }
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameRequests += 1;
    const id = ++nextFrame; pendingFrames.set(id, callback); return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { pendingFrames.delete(id); });
  vi.stubGlobal('IntersectionObserver', class {
    private readonly observed = new Set<ObserverRegistration>();
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element): void {
      const record = { target, callback: () => this.callback([{ target, isIntersecting: onScreen } as IntersectionObserverEntry], this as unknown as IntersectionObserver) };
      this.observed.add(record); intersections.add(record);
    }
    disconnect(): void { for (const record of this.observed) intersections.delete(record); this.observed.clear(); }
  });
  vi.stubGlobal('ResizeObserver', class {
    private readonly observed = new Set<ObserverRegistration>();
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element): void {
      const record = { target, callback: () => this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver) };
      this.observed.add(record); resizes.add(record);
    }
    disconnect(): void { for (const record of this.observed) resizes.delete(record); this.observed.clear(); }
  });
  const media = {
    get matches() { return reduced; }, media: '(prefers-reduced-motion: reduce)', onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { mediaListeners.add(listener); },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { mediaListeners.delete(listener); },
  };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  const context = {
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contextAvailable ? context as unknown as CanvasRenderingContext2D : null);
  return {
    context, history, pendingFrames,
    get frameRequests() { return frameRequests; },
    get mediaListenerCount() { return mediaListeners.size; },
    frame(now: number) { const callbacks = [...pendingFrames.values()]; pendingFrames.clear(); callbacks.forEach(callback => callback(now)); },
    intersect(visible: boolean) { onScreen = visible; for (const record of intersections) record.callback(); },
    resize() { for (const record of resizes) record.callback(); },
    visibility(hidden: boolean) {
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);
      document.dispatchEvent(new Event('visibilitychange'));
    },
    motion(value: boolean) {
      reduced = value;
      const event = new Event('change');
      for (const listener of mediaListeners) typeof listener === 'function' ? listener(event) : listener.handleEvent(event);
    },
    assertBalanced(host: HTMLElement) {
      expect(registrations).toEqual([]);
      expect(intersections.size).toBe(0); expect(resizes.size).toBe(0);
      expect(mediaListeners.size).toBe(0); expect(pendingFrames.size).toBe(0);
      expect(host.childNodes.length).toBe(0);
      expect(document.head.innerHTML).toBe(head); expect(document.styleSheets.length).toBe(sheets);
      expect(history.filter(r => (r.target === window || r.target === document) && /^key(?:down|up)$/.test(r.type))).toEqual([]);
    },
    restore() { vi.restoreAllMocks(); vi.unstubAllGlobals(); },
  };
}
