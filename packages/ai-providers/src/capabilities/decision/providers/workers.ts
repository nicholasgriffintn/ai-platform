import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { DecisionResponse } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { resolveAiGatewayId } from "../../../gateway.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type { DecisionProvider, DecisionRequest } from "../../../types/decision.js";
import { normaliseDecisionResponse } from "../../../utils/decisions.js";
import {
  resolveWorkersDecisionModel,
  validateWorkersDecisionRequest,
} from "../../../utils/workers-decisions.js";

const logger = getLogger({ prefix: "lib/decision/workers" });

export const WORKERS_AI_DECISION_PROVIDER_NAME = "workers-ai";

export class WorkersAiDecisionProvider implements DecisionProvider {
  readonly name = WORKERS_AI_DECISION_PROVIDER_NAME;

  constructor(
    private readonly env: ProviderEnv,
    private readonly user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {}

  async decide(request: DecisionRequest): Promise<DecisionResponse> {
    validateWorkersDecisionRequest(request);
    const { model, selector } = resolveWorkersDecisionModel(request.model);
    const ai = this.env.AI;

    if (!ai) {
      throw new AssistantError(
        "AI binding is required for Workers AI decisions",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model,
      env: this.env,
      userId: this.user?.id,
      completion_id: request.completion_id,
      request: {
        env: this.env,
        completion_id: request.completion_id,
        conversationId: request.conversationId,
      },
      settings: { questionCount: Object.keys(request.questions).length },
      operation: async () => {
        let raw: unknown;

        try {
          raw = await ai.run(
            model,
            { model: selector, state: request.state, questions: request.questions },
            { gateway: { id: resolveAiGatewayId(), skipCache: true } },
          );
        } catch (error) {
          logger.error("Workers AI decisions failed", {
            errorType: error instanceof AssistantError ? error.type : "unknown",
          });

          if (error instanceof AssistantError) {
            throw new AssistantError("Workers AI decisions failed", error.type, error.statusCode, {
              retryAfterMs: error.context?.retryAfterMs,
            });
          }

          throw new AssistantError("Workers AI decisions failed", ErrorType.EXTERNAL_API_ERROR);
        }

        return { ...normaliseDecisionResponse(raw, this.name, model), model };
      },
    });
  }
}
