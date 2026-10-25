import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import {
  commitKnowledgeDocument,
  knowledgeSourceId,
} from "~/modules/sources/application/knowledge/documents";
import { requireKnowledgeTarget } from "~/modules/sources/application/knowledge/targets";
import { knowledgeArticleKey } from "~/modules/sources/domain/knowledge/item";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type {
  ContentExtractParams,
  ContentExtractProvider,
  ContentExtractResult,
  ExtractedContentPayload,
} from "~/modules/tools/application/retrieval/content-extract-port";
import type { IRequest } from "~/types";

const MAX_STORED_ENTRIES = 10;

export async function maybeVectorizeExtractedContent({
  params,
  req,
  provider,
  extracted,
  result,
}: {
  params: ContentExtractParams;
  req: IRequest;
  provider: ContentExtractProvider;
  extracted: ExtractedContentPayload;
  result: ContentExtractResult;
}): Promise<void> {
  if (!params.should_vectorize || extracted.results.length === 0) {
    return;
  }

  try {
    if (extracted.results.length > MAX_STORED_ENTRIES) {
      throw new AssistantError(
        `At most ${MAX_STORED_ENTRIES} extracted entries can be stored`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const context = resolveServiceContext(req);
    const target = await requireKnowledgeTarget(
      context,
      { projectId: resolveRequestProjectId(req) ?? null, notebookId: null },
      { manage: false },
    );

    for (const entry of extracted.results) {
      const key = knowledgeArticleKey(entry.url);

      if (!key || !entry.raw_content?.trim()) {
        continue;
      }

      await commitKnowledgeDocument(context, target, {
        id: await knowledgeSourceId(target, key),
        kind: "url",
        title: entry.url.slice(0, 200),
        provider,
        externalUri: entry.url,
        content: entry.raw_content,
        metadata: { url: entry.url },
      });
    }

    result.data.vectorized = {
      success: true,
    };
  } catch {
    result.data.vectorized = {
      success: false,
      error: "Unable to store extracted content",
    };
  }
}
