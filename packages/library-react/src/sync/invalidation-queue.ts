import type { QueryClient } from "@tanstack/react-query";

export const SYNC_INVALIDATION_WINDOW_MS = 400;

export interface InvalidationQueue {
  push: (queryKey: readonly unknown[]) => void;
  flush: () => void;
  dispose: () => void;
}

export function createInvalidationQueue(
  queryClient: QueryClient,
  windowMs = SYNC_INVALIDATION_WINDOW_MS,
): InvalidationQueue {
  const pending = new Map<string, unknown[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    timer = undefined;

    const keys = [...pending.values()];

    pending.clear();

    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  return {
    push: (queryKey) => {
      pending.set(JSON.stringify(queryKey), [...queryKey]);
      timer ??= setTimeout(flush, windowMs);
    },
    flush: () => {
      if (timer) {
        clearTimeout(timer);
      }

      flush();
    },
    dispose: () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      pending.clear();
    },
  };
}
