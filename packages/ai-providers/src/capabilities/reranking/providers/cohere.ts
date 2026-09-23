import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { RerankingRequest, RerankingResponse } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { fetchAIResponse } from "../../../fetch.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type { RerankingProvider } from "../../../types/reranking.js";
import {
  assertRerankingResultCount,
  normaliseIndexedRerankingResponse,
  validateRerankingRequest,
} from "../normalise.js";

const logger = getLogger({ prefix: "lib/reranking/cohere" });

export const COHERE_RERANKING_PROVIDER_NAME = "cohere";
export const COHERE_DEFAULT_RERANKING_MODEL = "rerank-v4.0-fast";
export const COHERE_API_BASE_URL = "https://api.cohere.com";

function readResponse(
  raw: unknown,
  request: RerankingRequest,
): {
  results: { index: unknown; score: unknown }[];
  searchUnits?: number;
} {
  if (!isRecord(raw) || !Array.isArray(raw.results)) {
    throw new AssistantError(
      "Cohere returned an unexpected reranking payload",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  assertRerankingResultCount(COHERE_RERANKING_PROVIDER_NAME, request, raw.results.length);

  const results = raw.results.map((result) => {
    if (!isRecord(result)) {
      throw new AssistantError(
        "Cohere returned an unexpected reranking result",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return { index: result.index, score: result.relevance_score };
  });
  const billedUnits =
    isRecord(raw.meta) && isRecord(raw.meta.billed_units) ? raw.meta.billed_units : undefined;
  const searchUnits = billedUnits?.search_units;

  return {
    results,
    searchUnits:
      typeof searchUnits === "number" && Number.isSafeInteger(searchUnits) && searchUnits >= 0
        ? searchUnits
        : undefined,
  };
}

export class CohereRerankingProvider implements RerankingProvider {
  readonly name = COHERE_RERANKING_PROVIDER_NAME;

  constructor(
    private readonly env: ProviderEnv,
    private readonly user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {}

  async rerank(unvalidatedRequest: RerankingRequest): Promise<RerankingResponse> {
    const request = validateRerankingRequest(unvalidatedRequest);
    const model = request.model ?? COHERE_DEFAULT_RERANKING_MODEL;
    const apiKey = await resolveHostProviderApiKey(this.runtime.host, {
      env: this.env,
      providerName: this.name,
      envKeyName: "COHERE_API_KEY",
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
      settings: { documentCount: request.documents.length, topK: request.topK },
      operation: async () => {
        let raw: Record<string, unknown>;

        try {
          raw = await fetchAIResponse<Record<string, unknown>>(
            false,
            this.name,
            `${COHERE_API_BASE_URL}/v2/rerank`,
            {
              Accept: "application/json",
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            {
              model,
              query: request.query,
              documents: request.documents.map((document) => document.text),
              ...(request.topK === undefined ? {} : { top_n: request.topK }),
            },
            this.env,
            {
              requestTimeout: 30_000,
              maxAttempts: 1,
              responseType: "json",
              maxResponseBytes: 1_024 * 1_024,
              includeErrorBodyInLogs: false,
              timeoutIncludesBody: true,
            },
          );
        } catch (error) {
          logger.error("Cohere reranking failed", {
            errorType: error instanceof AssistantError ? error.type : "unknown",
          });

          if (error instanceof AssistantError) {
            throw new AssistantError("Cohere reranking failed", error.type, error.statusCode, {
              retryAfterMs: error.context?.retryAfterMs,
            });
          }

          throw new AssistantError("Cohere reranking failed", ErrorType.EXTERNAL_API_ERROR);
        }

        const response = readResponse(raw, request);

        return normaliseIndexedRerankingResponse({
          provider: this.name,
          model,
          request,
          results: response.results,
          usage:
            response.searchUnits === undefined ? undefined : { search_units: response.searchUnits },
        });
      },
    });
  }
}
