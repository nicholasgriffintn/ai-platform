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

    const requests = extracted.results.map((entry) =>
      createSourceSchema.parse({
        kind: "url",
        title: entry.url.slice(0, 200),
        content: entry.raw_content,
        externalUri: entry.url,
        provider,
        metadata: { url: entry.url },
      }),
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
