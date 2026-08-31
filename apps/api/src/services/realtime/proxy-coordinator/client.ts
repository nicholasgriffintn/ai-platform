import { getDurableObjectStub, postDurableObjectJson } from "~/lib/durable-objects/client";
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
  const stub = getDurableObjectStub(env.REALTIME_PROXY_COORDINATOR, String(userId));

  if (!stub) {
    throw new AssistantError(
      "Realtime proxy coordinator is not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const response = await postDurableObjectJson(stub, `${COORDINATOR_ORIGIN}/consume`, {
    expiresAt: expiresAt * 1000,
    jti,
    sessionExpiresAt: Date.now() + REALTIME_PROXY_LIMITS.sessionDurationMs,
    sessionId,
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
        const releaseResponse = await postDurableObjectJson(stub, `${COORDINATOR_ORIGIN}/release`, {
          jti,
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
