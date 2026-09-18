import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { getLogger } from "../logger.js";
import type { TelemetryEnv, TelemetrySink } from "../types.js";

const logger = getLogger({ prefix: "ai-telemetry/ai-gateway" });

export function createAiGatewaySink(
  env: TelemetryEnv,
  resolveAiGatewayId: () => string,
): TelemetrySink | null {
  const ai = env.AI;

  if (!ai || !env.AI_GATEWAY_TOKEN || !env.ACCOUNT_ID) {
    return null;
  }

  return {
    name: "ai_gateway",
    async captureAiFeedback(feedback) {
      if (!feedback.logId) {
        return;
      }

      try {
        await ai.gateway(resolveAiGatewayId()).patchLog(feedback.logId, {
          feedback: feedback.feedback,
          score: feedback.score,
          metadata: feedback.user?.email ? { user: feedback.user.email } : null,
        });
      } catch (error) {
        logger.error("Failed to send feedback to AI Gateway", {
          error: getErrorMessage(error),
          logId: feedback.logId,
        });
      }
    },
  };
}
