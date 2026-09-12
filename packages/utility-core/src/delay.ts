export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Operation aborted"));

      return;
    }

    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("Operation aborted"));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);

    signal?.addEventListener("abort", abort, { once: true });
  });
}

export function abortableDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  return delay(delayMs, signal);
}
