import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { DecisionResponse } from "@ngriffin_uk/polychat-schemas";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { fetchAIResponse } from "../../../fetch.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type { DecisionProvider, DecisionRequest } from "../../../types/decision.js";
import {
  buildOpenAIDecisionRequest,
  normaliseOpenAIDecisionResponse,
} from "../../../utils/openai-decisions.js";

const logger = getLogger({ prefix: "lib/decision/openai" });

export const OPENAI_DECISION_PROVIDER_NAME = "openai";
export const OPENAI_DEFAULT_DECISION_MODEL = "gpt-6-luna";

export class OpenAIDecisionProvider implements DecisionProvider {
  readonly name = OPENAI_DECISION_PROVIDER_NAME;

  constructor(
    private readonly env: ProviderEnv,
    private readonly user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {}

  async decide(request: DecisionRequest): Promise<DecisionResponse> {
    const model = request.model ?? OPENAI_DEFAULT_DECISION_MODEL;
    const body = buildOpenAIDecisionRequest(request, model);
    const apiKey = await resolveHostProviderApiKey(this.runtime.host, {
      env: this.env,
      providerName: this.name,
      envKeyName: "OPENAI_API_KEY",
      userId: this.user?.id,
      logger,
    });

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
      settings: { questionCount: body.questions.length },
      operation: async () => {
        const raw = await fetchAIResponse<unknown>(
          false,
          this.name,
          "https://api.openai.com/v1/decisions",
          { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body,
          this.env,
          { includeErrorBodyInLogs: false, timeoutIncludesBody: true, maxResponseBytes: 1_048_576 },
        );

        return normaliseOpenAIDecisionResponse(raw, request.questions);
      },
    });
  }
}
