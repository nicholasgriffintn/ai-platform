export const REALTIME_SESSION_FINALIZATION_TIMEOUT_MS = 5_000;

export interface RealtimeSessionLease {
  readonly id: number;
  readonly signal: AbortSignal;
}

interface RealtimeSessionControllerOptions {
  clearTimeout?: (timer: ReturnType<typeof setTimeout>) => void;
  finalizationTimeoutMs?: number;
  setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
}

export interface RealtimeSessionController {
  begin(): RealtimeSessionLease;
  cancel(): void;
  complete(lease: RealtimeSessionLease): boolean;
  finalize(lease: RealtimeSessionLease, onTimeout: () => void): boolean;
  isCurrent(lease: RealtimeSessionLease | null | undefined): lease is RealtimeSessionLease;
}

export function createRealtimeSessionController(
  options: RealtimeSessionControllerOptions = {},
): RealtimeSessionController {
  const clearScheduledTimeout = options.clearTimeout ?? clearTimeout;
  const scheduleTimeout = options.setTimeout ?? setTimeout;
  const finalizationTimeoutMs =
    options.finalizationTimeoutMs ?? REALTIME_SESSION_FINALIZATION_TIMEOUT_MS;
  let nextId = 0;
  let current:
    | {
        abortController: AbortController;
        finalizationTimer: ReturnType<typeof setTimeout> | null;
        lease: RealtimeSessionLease;
      }
    | undefined;

  const clearFinalizationTimer = (session: typeof current = current) => {
    if (!session?.finalizationTimer) {
      return;
    }

    clearScheduledTimeout(session.finalizationTimer);
    session.finalizationTimer = null;
  };

  const cancel = () => {
    const cancelledSession = current;

    current = undefined;
    clearFinalizationTimer(cancelledSession);
    cancelledSession?.abortController.abort();
  };

  const isCurrent = (
    lease: RealtimeSessionLease | null | undefined,
  ): lease is RealtimeSessionLease => Boolean(lease && current?.lease === lease);

  return {
    begin() {
      cancel();

      const abortController = new AbortController();
      const lease = { id: ++nextId, signal: abortController.signal };

      current = { abortController, finalizationTimer: null, lease };

      return lease;
    },
    cancel,
    complete(lease) {
      if (!isCurrent(lease)) {
        return false;
      }

      clearFinalizationTimer();
      current = undefined;

      return true;
    },
    finalize(lease, onTimeout) {
      const activeSession = current;

      if (!activeSession || activeSession.lease !== lease) {
        return false;
      }

      clearFinalizationTimer(activeSession);
      activeSession.finalizationTimer = scheduleTimeout(() => {
        if (!isCurrent(lease)) {
          return;
        }

        current = undefined;
        onTimeout();
      }, finalizationTimeoutMs);

      return true;
    },
    isCurrent,
  };
}
