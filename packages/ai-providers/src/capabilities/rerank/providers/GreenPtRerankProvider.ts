import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { formatProviderError } from "../../../utils/errors.js";
import { greenPtJsonRequest, resolveGreenPtApiKey } from "../../../utils/greenpt.js";
import { BaseRerankProvider } from "../base.js";
import type { RerankRequest, RerankResult } from "../index.js";

export const GREENPT_RERANK_MODELS = ["green-rerank"];

interface GreenPtRerankResponse {
  id?: string;
  model?: string;
  usage?: { total_tokens?: number };
  results?: Array<{
    index: number;
    relevance_score: number;
    document?: { text?: string } | string;
  }>;
}

export class GreenPtRerankProvider extends BaseRerankProvider {
  name = "greenpt";
  models = GREENPT_RERANK_MODELS;

  async rerank(request: RerankRequest): Promise<RerankResult> {
    this.validateRequest(request);

    const model = this.resolveModel(request);

    try {
      const apiKey = await resolveGreenPtApiKey(this.runtime.host, {
        env: request.env,
        userId: request.user?.id,
      });
      const data = await greenPtJsonRequest<GreenPtRerankResponse>({
        apiKey,
        path: "/rerank",
        label: "GreenPT rerank",
        payload: {
          model,
          query: request.query,
          documents: request.documents.map((document) =>
            typeof document === "string" ? document : { text: document.text },
          ),
          ...(request.topN !== undefined ? { top_n: request.topN } : {}),
          return_documents: request.returnDocuments ?? false,
        },
      });

      if (!Array.isArray(data.results)) {
        throw new AssistantError(
          "GreenPT rerank returned no results",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      return {
        provider: "greenpt",
        model: data.model ?? model,
        usage: { totalTokens: data.usage?.total_tokens },
        results: data.results.map((result) => ({
          index: result.index,
          relevanceScore: result.relevance_score,
          ...(request.returnDocuments ? { document: request.documents[result.index] } : {}),
        })),
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        await formatProviderError(error, "GreenPT rerank error"),
        ErrorType.EXTERNAL_API_ERROR,
      );
    }
  }
}
