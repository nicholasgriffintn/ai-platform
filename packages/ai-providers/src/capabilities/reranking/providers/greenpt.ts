import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { RerankingRequest, RerankingResponse } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type { RerankingProvider } from "../../../types/reranking.js";
import { greenPtJsonRequest, resolveGreenPtApiKey } from "../../../utils/greenpt.js";
import {
  assertRerankingResultCount,
  normaliseIndexedRerankingResponse,
  validateRerankingRequest,
} from "../normalise.js";

const logger = getLogger({ prefix: "lib/reranking/greenpt" });

export const GREENPT_RERANKING_PROVIDER_NAME = "greenpt";
export const GREENPT_DEFAULT_RERANKING_MODEL = "green-rerank";

function readResults(
  raw: unknown,
  request: RerankingRequest,
): { results: { index: unknown; score: unknown }[]; inputTokens?: number } {
  if (!isRecord(raw) || !Array.isArray(raw.results)) {
    throw new AssistantError(
      "GreenPT returned an unexpected reranking payload",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  assertRerankingResultCount(GREENPT_RERANKING_PROVIDER_NAME, request, raw.results.length);

  const results = raw.results.map((result) => {
    if (!isRecord(result)) {
      throw new AssistantError(
        "GreenPT returned an unexpected reranking result",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return { index: result.index, score: result.relevance_score };
  });
  const totalTokens = isRecord(raw.usage) ? raw.usage.total_tokens : undefined;

  return {
    results,
    inputTokens:
      typeof totalTokens === "number" && Number.isSafeInteger(totalTokens) && totalTokens >= 0
        ? totalTokens
        : undefined,
  };
}

export class GreenPtRerankingProvider implements RerankingProvider {
  readonly name = GREENPT_RERANKING_PROVIDER_NAME;

  constructor(
    private readonly env: ProviderEnv,
    private readonly user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {}

  async rerank(unvalidatedRequest: RerankingRequest): Promise<RerankingResponse> {
    const request = validateRerankingRequest(unvalidatedRequest);
    const model = request.model ?? GREENPT_DEFAULT_RERANKING_MODEL;

    if (model !== GREENPT_DEFAULT_RERANKING_MODEL) {
      throw new AssistantError(
        `Model ${model} is not supported by the GreenPT reranking provider`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const apiKey = await resolveGreenPtApiKey(this.runtime.host, {
      env: this.env,
      userId: this.user?.id,
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
      settings: { documentCount: request.documents.length, topK: request.topK },
      operation: async () => {
        let raw: unknown;

        try {
          raw = await greenPtJsonRequest({
            apiKey,
            path: "/rerank",
            label: "GreenPT reranking",
            payload: {
              model,
              query: request.query,
              documents: request.documents.map((document) => document.text),
              ...(request.topK === undefined ? {} : { top_n: request.topK }),
              return_documents: false,
            },
          });
        } catch (error) {
          logger.error("GreenPT reranking failed", {
            errorType: error instanceof AssistantError ? error.type : "unknown",
          });

          if (error instanceof AssistantError) {
            throw new AssistantError("GreenPT reranking failed", error.type, error.statusCode, {
              retryAfterMs: error.context?.retryAfterMs,
            });
          }

          throw new AssistantError("GreenPT reranking failed", ErrorType.EXTERNAL_API_ERROR);
        }

        const response = readResults(raw, request);

        return normaliseIndexedRerankingResponse({
          provider: this.name,
          model,
          request,
          results: response.results,
          usage:
            response.inputTokens === undefined ? undefined : { input_tokens: response.inputTokens },
        });
      },
    });
  }
}
