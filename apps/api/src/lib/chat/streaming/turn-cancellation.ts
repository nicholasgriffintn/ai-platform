import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

const CANCELLATION_KEY_PREFIX = "chat-turn-cancel:";
const CANCELLATION_TTL_SECONDS = 120;
const DETACHED_FAST_POLL_INTERVAL_MS = 1_000;
const DETACHED_FAST_POLL_WINDOW_MS = 30_000;
const DETACHED_SLOW_POLL_INTERVAL_MS = 5_000;

const logger = getLogger({ prefix: "lib/chat/streaming/turn-cancellation" });

function cancellationKey(completionId: string): string {
  return `${CANCELLATION_KEY_PREFIX}${completionId}`;
}

export async function requestTurnCancellation(env: IEnv, completionId: string): Promise<void> {
  if (!env?.CACHE) {
    return;
  }

  await env.CACHE.put(cancellationKey(completionId), String(Date.now()), {
    expirationTtl: CANCELLATION_TTL_SECONDS,
  });
}

async function isTurnCancellationRequested(
  env: IEnv,
  completionId: string,
  notBefore: number,
): Promise<boolean> {
  if (!env?.CACHE) {
    return false;
  }

  try {
    const requestedAt = Number(await env.CACHE.get(cancellationKey(completionId)));

    return Number.isFinite(requestedAt) && requestedAt >= notBefore;
  } catch (error) {
    logger.error("Failed to read the turn cancellation flag", { error, completionId });

    return false;
  }
}

export interface TurnStopSignal {
  shouldStop: () => boolean;
  stop: () => void;
}

export function watchTurnCancellation(params: {
  env: IEnv;
  completionId: string;
  isDetached: () => boolean;
  isRunCancellationRequested?: () => Promise<boolean>;
}): TurnStopSignal {
  const { env, completionId, isDetached, isRunCancellationRequested } = params;
  const startedAt = Date.now();
  let stopRequested = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const nextIntervalMs = () =>
    Date.now() - startedAt < DETACHED_FAST_POLL_WINDOW_MS
      ? DETACHED_FAST_POLL_INTERVAL_MS
      : DETACHED_SLOW_POLL_INTERVAL_MS;

  const scheduleNext = () => {
    if (stopped) {
      return;
    }

    timer = setTimeout(tick, nextIntervalMs());
  };

  const tick = () => {
    if (stopped) {
      return;
    }

    if (!isRunCancellationRequested && !isDetached()) {
      scheduleNext();

      return;
    }

    const requested = isRunCancellationRequested
      ? isRunCancellationRequested()
      : isTurnCancellationRequested(env, completionId, startedAt);

    void requested
      .then((cancelled) => {
        stopRequested ||= cancelled;

        return cancelled;
      })
      .catch((error) => {
        logger.error("Failed to read the run cancellation state", { error, completionId });
      })
      .finally(() => {
        if (!stopRequested) {
          scheduleNext();
        }
      });
  };

  scheduleNext();

  return {
    shouldStop: () => stopRequested,
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
