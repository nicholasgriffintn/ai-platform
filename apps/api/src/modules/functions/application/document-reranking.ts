import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/functions/document-reranking" });
const MAX_RERANK_QUERY_CHARS = 4_000;
const MAX_RERANK_DOCUMENT_CHARS = 8_000;

export interface DocumentRerankingProvenance {
  provider: string;
  model: string;
  score: number;
}

export interface RerankableDocument {
  content: string;
  title?: string;
  rankingMethod: string;
  reranking?: unknown;
}

export type RerankedDocument<T extends RerankableDocument> = Omit<
  T,
  "rankingMethod" | "reranking"
> & {
  rankingMethod: "model-rerank";
  reranking: DocumentRerankingProvenance;
};

function documentText(document: RerankableDocument): string {
  const text = document.title ? `${document.title}\n\n${document.content}` : document.content;

  return truncateForModel(text, MAX_RERANK_DOCUMENT_CHARS);
}

function failureClass(error: unknown): string {
  return error instanceof AssistantError ? error.type : ErrorType.UNKNOWN_ERROR;
}

function withRerankingProvenance<T extends RerankableDocument>(
  document: T,
  provenance: DocumentRerankingProvenance,
): RerankedDocument<T> {
  const { rankingMethod: _rankingMethod, reranking: _reranking, ...documentFields } = document;

  return {
    ...documentFields,
    rankingMethod: "model-rerank",
    reranking: provenance,
  };
}

export async function rerankAuthorisedDocuments<T extends RerankableDocument>(params: {
  env: IEnv;
  user?: IUser;
  completionId?: string;
  conversationId?: string;
  model?: string;
  provider?: string;
  query: string;
  documents: readonly T[];
}): Promise<Array<T | RerankedDocument<T>>> {
  if (params.documents.length < 2) {
    return [...params.documents];
  }

  try {
    const result = await ai.tryRerank<T>({
      env: params.env,
      user: params.user,
      completion_id: params.completionId,
      conversationId: params.conversationId,
      model: params.model,
      provider: params.provider,
      query: truncateForModel(params.query, MAX_RERANK_QUERY_CHARS),
      documents: params.documents,
      toText: documentText,
      topK: params.documents.length,
    });

    if (!result) {
      return [...params.documents];
    }

    return result.results.map(({ document, score }) =>
      withRerankingProvenance(document, {
        provider: result.provider,
        model: result.model,
        score,
      }),
    );
  } catch (error) {
    logger.warn("Document reranking failed; preserving authorised baseline order", {
      failureClass: failureClass(error),
    });

    return [...params.documents];
  }
}
