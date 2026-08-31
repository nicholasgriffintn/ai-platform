import type { InsertEmbeddingInput } from "@ngriffin_uk/polychat-schemas";

import { deleteEmbedding } from "~/services/apps/embeddings/delete";
import { insertEmbedding } from "~/services/apps/embeddings/insert";
import { parseInsertEmbeddingRequest } from "~/services/apps/embeddings/requests";
import { resolveRequestProjectId } from "~/services/functions/request-context";
import type { IRequest } from "~/types";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";

import type {
  ContentExtractParams,
  ContentExtractProvider,
  ContentExtractResult,
  ExtractedContentPayload,
} from "../../types/content-extract";

async function generateShortId(text: string): Promise<string> {
  return `tx_${(await sha256Hex(text)).slice(0, 24)}`;
}

const MAX_VECTORIZED_ENTRIES = 10;

const requirePersonalVectorization = (params: ContentExtractParams, req: IRequest): void => {
  if (params.namespace || resolveRequestProjectId(req)) {
    throw new AssistantError(
      "Only personal document storage is available",
      ErrorType.CONFIGURATION_ERROR,
      501,
    );
  }
};

const getExtractionSource = (
  provider: ContentExtractProvider,
  params: ContentExtractParams,
): string =>
  provider === "cloudflare"
    ? `cloudflare_${params.cloudflareCrawlOptions?.enabled ? "crawl" : (params.cloudflareFormat ?? "markdown")}`
    : "tavily_extract";

const createEmbeddingRequest = async ({
  entry,
  params,
  provider,
}: {
  entry: ExtractedContentPayload["results"][number];
  params: ContentExtractParams;
  provider: ContentExtractProvider;
}): Promise<InsertEmbeddingInput> =>
  parseInsertEmbeddingRequest({
    id: await generateShortId(entry.url),
    type: "webpage",
    title: entry.url.slice(0, 200),
    content: entry.raw_content,
    metadata: {
      url: entry.url,
      source: getExtractionSource(provider, params),
    },
  });

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
    requirePersonalVectorization(params, req);

    if (extracted.results.length > MAX_VECTORIZED_ENTRIES) {
      throw new AssistantError(
        `At most ${MAX_VECTORIZED_ENTRIES} extracted entries can be stored`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const requests = await Promise.all(
      extracted.results.map((entry) => createEmbeddingRequest({ entry, params, provider })),
    );
    const insertedIds: string[] = [];

    try {
      for (const request of requests) {
        // Keep writes ordered so a later failure can compensate the exact durable prefix.
        // oxlint-disable-next-line eslint/no-await-in-loop
        const response = await insertEmbedding({
          context: req.context,
          env: req.env,
          user: req.user,
          request,
        });

        insertedIds.push(response.data.id);
      }
    } catch (error) {
      if (insertedIds.length > 0) {
        try {
          await deleteEmbedding({
            context: req.context,
            env: req.env,
            user: req.user,
            request: { ids: insertedIds },
          });
        } catch {
          // Delete-pending records remain excluded from retrieval and can be retried safely.
        }
      }

      throw error;
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
