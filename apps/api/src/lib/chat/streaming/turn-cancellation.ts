import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

const CANCELLATION_KEY_PREFIX = "chat-turn-cancel:";
const CANCELLATION_TTL_SECONDS = 120;
const DETACHED_CHECK_INTERVAL_MS = 1_000;
const DETACHED_CHECK_LIMIT = 5;

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

export function watchDetachedTurnCancellation(params: {
  env: IEnv;
  completionId: string;
  isDetached: () => boolean;
}): TurnStopSignal {
  const { env, completionId, isDetached } = params;
  const startedAt = Date.now();
  let stopRequested = false;
  let checksRemaining = DETACHED_CHECK_LIMIT;
  let checking = false;

  const timer = setInterval(() => {
    if (stopRequested || checking || checksRemaining <= 0 || !isDetached()) {
      return;
    }

    checking = true;
    checksRemaining -= 1;

    void isTurnCancellationRequested(env, completionId, startedAt)
      .then((cancelled) => {
        stopRequested ||= cancelled;
      })
      .finally(() => {
        checking = false;
      });
  }, DETACHED_CHECK_INTERVAL_MS);

  return {
    shouldStop: () => stopRequested,
    stop: () => clearInterval(timer),
  };
}
