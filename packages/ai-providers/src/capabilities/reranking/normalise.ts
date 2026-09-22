import {
  rerankingRequestSchema,
  rerankingResponseSchema,
  rerankingResultsMatchRequest,
  type RerankingRequest,
  type RerankingResponse,
  type RerankingUsage,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export interface IndexedRerankingResult {
  index: unknown;
  score: unknown;
}

export function assertRerankingResultCount(
  provider: string,
  request: Pick<RerankingRequest, "documents" | "topK">,
  resultCount: number,
): void {
  const expectedCount = request.topK ?? request.documents.length;

  if (resultCount !== expectedCount) {
    throw new AssistantError(
      `${provider} returned an incomplete or excessive reranking response`,
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }
}

export function validateRerankingRequest(request: RerankingRequest): RerankingRequest {
  const parsed = rerankingRequestSchema.safeParse(request);

  if (!parsed.success) {
    throw new AssistantError(
      `Invalid reranking request: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return parsed.data;
}

export function normaliseIndexedRerankingResponse(options: {
  provider: string;
  model: string;
  request: RerankingRequest;
  results: readonly IndexedRerankingResult[];
  usage?: RerankingUsage;
}): RerankingResponse {
  assertRerankingResultCount(options.provider, options.request, options.results.length);

  const results = options.results.map((result) => {
    if (
      typeof result.index !== "number" ||
      !Number.isSafeInteger(result.index) ||
      result.index < 0 ||
      result.index >= options.request.documents.length ||
      typeof result.score !== "number" ||
      !Number.isFinite(result.score)
    ) {
      throw new AssistantError(
        `${options.provider} returned an invalid reranking result`,
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    const document = options.request.documents[result.index];

    if (!document) {
      throw new AssistantError(
        `${options.provider} returned a foreign reranking result`,
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return { id: document.id, score: result.score };
  });
  const response = rerankingResponseSchema.safeParse({
    provider: options.provider,
    model: options.model,
    results,
    usage: options.usage,
  });

  if (!response.success || !rerankingResultsMatchRequest(options.request, response.data.results)) {
    throw new AssistantError(
      `${options.provider} returned an incomplete or inconsistent reranking response`,
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  return response.data;
}
