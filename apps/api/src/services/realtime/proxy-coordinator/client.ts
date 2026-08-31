import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

import { REALTIME_PROXY_LIMITS } from "../transcriptionProxy";

const logger = getLogger({ prefix: "services/realtime/proxy-coordinator/client" });
const COORDINATOR_ORIGIN = "https://realtime-proxy-coordinator";

export interface RealtimeProxyReservation {
  release(): Promise<void>;
}

export async function reserveRealtimeProxySession({
  env,
  expiresAt,
  jti,
  sessionId,
  userId,
}: {
  env: IEnv;
  expiresAt: number;
  jti: string;
  sessionId: string;
  userId: number;
}): Promise<RealtimeProxyReservation> {
  if (!env.REALTIME_PROXY_COORDINATOR) {
    throw new AssistantError(
      "Realtime proxy coordinator is not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const id = env.REALTIME_PROXY_COORDINATOR.idFromName(String(userId));
  const stub = env.REALTIME_PROXY_COORDINATOR.get(id);
  const response = await stub.fetch(`${COORDINATOR_ORIGIN}/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expiresAt: expiresAt * 1000,
      jti,
      sessionExpiresAt: Date.now() + REALTIME_PROXY_LIMITS.sessionDurationMs,
      sessionId,
    }),
  });

  if (!response.ok) {
    throw new AssistantError(
      "Realtime proxy reservation failed",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const result = (await response.json()) as { acquired?: unknown; reason?: unknown };

  if (!result.acquired) {
    const replayed = result.reason === "replayed";

    throw new AssistantError(
      replayed ? "Realtime proxy grant was already used" : "Realtime session limit reached",
      replayed ? ErrorType.AUTHENTICATION_ERROR : ErrorType.RATE_LIMIT_ERROR,
      replayed ? 401 : 429,
    );
  }

  let released = false;

  return {
    async release(): Promise<void> {
      if (released) {
        return;
      }

      released = true;

      try {
        const releaseResponse = await stub.fetch(`${COORDINATOR_ORIGIN}/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jti }),
        });

        if (!releaseResponse.ok) {
          logger.error("Realtime proxy reservation release failed", {
            status: releaseResponse.status,
            userId,
          });
        }
      } catch (error) {
        logger.error("Realtime proxy reservation release failed", { error, userId });
      }
    },
  };
}
