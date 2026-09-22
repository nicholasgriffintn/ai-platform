import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { RerankingRequest, RerankingResponse } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { resolveAiGatewayId } from "../../../gateway.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type { RerankingProvider } from "../../../types/reranking.js";
import {
  assertRerankingResultCount,
  normaliseIndexedRerankingResponse,
  validateRerankingRequest,
} from "../normalise.js";

const logger = getLogger({ prefix: "lib/reranking/workers" });

export const WORKERS_AI_RERANKING_PROVIDER_NAME = "workers-ai";
export const WORKERS_AI_DEFAULT_RERANKING_MODEL = "@cf/baai/bge-reranker-base";

function readResults(
  raw: unknown,
  request: RerankingRequest,
): { index: unknown; score: unknown }[] {
  if (!isRecord(raw) || !Array.isArray(raw.response)) {
    throw new AssistantError(
      "Workers AI returned an unexpected reranking payload",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  assertRerankingResultCount(WORKERS_AI_RERANKING_PROVIDER_NAME, request, raw.response.length);

  return raw.response.map((result) => {
    if (!isRecord(result)) {
      throw new AssistantError(
        "Workers AI returned an unexpected reranking result",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return { index: result.id, score: result.score };
  });
}

export class WorkersAiRerankingProvider implements RerankingProvider {
  readonly name = WORKERS_AI_RERANKING_PROVIDER_NAME;

  constructor(
    private readonly env: ProviderEnv,
    private readonly user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {}

  async rerank(unvalidatedRequest: RerankingRequest): Promise<RerankingResponse> {
    const request = validateRerankingRequest(unvalidatedRequest);
    const model = request.model ?? WORKERS_AI_DEFAULT_RERANKING_MODEL;

    if (!this.env.AI) {
      throw new AssistantError(
        "AI binding is required for Workers AI reranking",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const ai = this.env.AI;

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
      settings: { documentCount: request.documents.length, topK: request.topK },
      operation: async () => {
        let raw: unknown;

        try {
          raw = await ai.run(
            model,
            {
              query: request.query,
              contexts: request.documents.map((document) => ({
                text: document.text,
              })),
              ...(request.topK === undefined ? {} : { top_k: request.topK }),
            },
            { gateway: { id: resolveAiGatewayId(), skipCache: true } },
          );
        } catch (error) {
          logger.error("Workers AI reranking failed", {
            errorType: error instanceof AssistantError ? error.type : "unknown",
          });

          if (error instanceof AssistantError) {
            throw new AssistantError("Workers AI reranking failed", error.type, error.statusCode, {
              retryAfterMs: error.context?.retryAfterMs,
            });
          }

          throw new AssistantError("Workers AI reranking failed", ErrorType.EXTERNAL_API_ERROR);
        }

        return normaliseIndexedRerankingResponse({
          provider: this.name,
          model,
          request,
          results: readResults(raw, request),
        });
      },
    });
  }
}
