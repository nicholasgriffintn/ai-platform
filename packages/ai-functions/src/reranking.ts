import type { ProviderRuntime } from "@ngriffin_uk/polychat-ai-providers";
import {
  RERANKING_MAX_DOCUMENTS,
  rerankingRequestSchema,
  rerankingResponseSchema,
  rerankingResultsMatchRequest,
  type RerankingUsage,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { AiRequestScope } from "./types.js";

export interface RerankingScope extends AiRequestScope {
  model?: string;
  provider?: string;
  conversationId?: string;
}

export interface RerankRequest<TDocument> extends RerankingScope {
  query: string;
  documents: readonly TDocument[];
  toText(document: TDocument, index: number): string;
  topK?: number;
}

export interface RerankedDocument<TDocument> {
  document: TDocument;
  originalIndex: number;
  score: number;
}

export interface RerankResult<TDocument> {
  provider: string;
  model: string;
  results: RerankedDocument<TDocument>[];
  usage?: RerankingUsage;
}

export interface RerankingTarget {
  provider: string;
  model: string;
}

function assertRerankingDocumentCount(documents: readonly unknown[]): void {
  if (documents.length < 1 || documents.length > RERANKING_MAX_DOCUMENTS) {
    throw new AssistantError(
      `Reranking requires between 1 and ${RERANKING_MAX_DOCUMENTS} documents`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

export function createRerankingFunctions(runtime: ProviderRuntime) {
  const resolveRerankingTarget = async (scope: RerankingScope): Promise<RerankingTarget | null> => {
    return runtime.host.models.resolveRerankingModel(scope.env, scope.user, {
      model: scope.model,
      provider: scope.provider,
    });
  };

  const run = async <TDocument>(
    request: RerankRequest<TDocument>,
    target: RerankingTarget,
  ): Promise<RerankResult<TDocument>> => {
    const providerRequest = rerankingRequestSchema.safeParse({
      query: request.query,
      documents: request.documents.map((document, index) => ({
        id: index,
        text: request.toText(document, index),
      })),
      model: target.model || undefined,
      topK: request.topK,
      completion_id: request.completion_id,
      conversationId: request.conversationId,
    });

    if (!providerRequest.success) {
      throw new AssistantError(
        `Invalid reranking request: ${providerRequest.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const provider = runtime.providers.resolve("reranking", target.provider, {
      env: request.env,
      user: request.user,
    });
    const unvalidatedResponse = await provider.rerank(providerRequest.data);
    const expectedResultCount = providerRequest.data.topK ?? providerRequest.data.documents.length;

    if (
      !isRecord(unvalidatedResponse) ||
      !Array.isArray(unvalidatedResponse.results) ||
      unvalidatedResponse.results.length !== expectedResultCount
    ) {
      throw new AssistantError(
        "The reranking provider returned an unexpected number of results",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    const response = rerankingResponseSchema.safeParse(unvalidatedResponse);

    if (
      !response.success ||
      !rerankingResultsMatchRequest(providerRequest.data, response.data.results) ||
      response.data.provider !== target.provider ||
      response.data.model !== target.model
    ) {
      throw new AssistantError(
        "The reranking provider returned results that do not match the requested documents",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    const results = response.data.results.map((result) => {
      if (typeof result.id !== "number") {
        throw new AssistantError(
          "The reranking provider changed an opaque document ID",
          ErrorType.PROVIDER_ERROR,
          502,
        );
      }

      const document = request.documents[result.id];

      if (document === undefined) {
        throw new AssistantError(
          "The reranking provider returned a foreign document ID",
          ErrorType.PROVIDER_ERROR,
          502,
        );
      }

      return { document, originalIndex: result.id, score: result.score };
    });

    results.sort(
      (left, right) => right.score - left.score || left.originalIndex - right.originalIndex,
    );

    return {
      provider: response.data.provider,
      model: response.data.model,
      results,
      usage: response.data.usage,
    };
  };

  return {
    rerank: async <TDocument>(request: RerankRequest<TDocument>) => {
      assertRerankingDocumentCount(request.documents);
      const target = await resolveRerankingTarget(request);

      if (!target) {
        throw new AssistantError(
          "No reranking model is available for this account",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      return run(request, target);
    },
    tryRerank: async <TDocument>(request: RerankRequest<TDocument>) => {
      assertRerankingDocumentCount(request.documents);
      const target = await resolveRerankingTarget(request);

      return target ? run(request, target) : null;
    },
  };
}

export type RerankingFunctions = ReturnType<typeof createRerankingFunctions>;
