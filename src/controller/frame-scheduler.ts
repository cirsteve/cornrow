export type FrameHandle = number;
export interface FrameScheduler {
  request(callback: (nowMs: number) => void): FrameHandle;
  cancel(handle: FrameHandle): void;
}

/** Only the mount layer calls this factory; importing the module needs no browser. */
export function createAnimationFrameScheduler(): FrameScheduler {
  const request = globalThis.requestAnimationFrame.bind(globalThis);
  const cancel = globalThis.cancelAnimationFrame.bind(globalThis);
  return { request, cancel };
}
