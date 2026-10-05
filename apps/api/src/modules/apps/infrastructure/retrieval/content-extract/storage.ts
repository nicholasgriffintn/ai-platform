import { createSourceSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import type {
  ContentExtractParams,
  ContentExtractProvider,
  ContentExtractResult,
  ExtractedContentPayload,
} from "~/modules/apps/application/ports/content-extract";
import { resolveRequestProjectId } from "~/modules/functions/application/request-context";
import { createSource } from "~/modules/sources/application/sources";
import type { IRequest } from "~/types";

const MAX_STORED_ENTRIES = 10;

const getExtractionSource = (
  provider: ContentExtractProvider,
  params: ContentExtractParams,
): string => {
  if (provider === "cloudflare") {
    return `cloudflare_${params.cloudflareCrawlOptions?.enabled ? "crawl" : (params.cloudflareFormat ?? "markdown")}`;
  }

  return provider === "greenpt" ? "greenpt_scrape" : "tavily_extract";
};

const createExtractedSource = ({
  entry,
  params,
  provider,
}: {
  entry: ExtractedContentPayload["results"][number];
  params: ContentExtractParams;
  provider: ContentExtractProvider;
}) =>
  createSourceSchema.parse({
    kind: "url",
    title: entry.url.slice(0, 200),
    content: entry.raw_content,
    externalUri: entry.url,
    metadata: {
      url: entry.url,
      source: getExtractionSource(provider, params),
    },
  });

export async function maybeStoreExtractedKnowledge({
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
  if (!params.storeKnowledge || extracted.results.length === 0) {
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

    const requests = extracted.results.map((entry) =>
      createExtractedSource({ entry, params, provider }),
    );
    const context = resolveServiceContext(req);
    const user = context.requireUser();
    const projectId = resolveRequestProjectId(req);
    const insertedIds: string[] = [];

    try {
      for (const request of requests) {
        const response = await createSource(context, user.id, { ...request, projectId });

        insertedIds.push(response.id);
      }
    } catch (error) {
      if (insertedIds.length > 0) {
        try {
          await context.repositories.sources.removeCreatedSources(user.id, projectId, insertedIds);
        } catch {
          context.getLogger().warn("Extracted source rollback deferred");
        }
      }

      throw error;
    }

    result.data.storedKnowledge = {
      success: true,
    };
  } catch {
    result.data.storedKnowledge = {
      success: false,
      error: "Unable to store extracted content",
    };
  }
}
