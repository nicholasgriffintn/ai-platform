import type z from "zod/v4";

import { analyseArticle } from "~/services/apps/articles/analyse";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import {
  analyse_article as analyseArticleDescriptor,
  type analyseArticleInputSchema,
} from "./definitions/analyse_article";
import { resolveRequestProjectId } from "./request-context";

export const analyse_article: ApiToolDefinition = {
  ...analyseArticleDescriptor,
  execute: async (args: z.infer<typeof analyseArticleInputSchema>, toolContext) => {
    const request = toolContext.request;
    const user = request.user;

    if (!user?.id) {
      throw new AssistantError(
        "Analysing an article needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = resolveRequestProjectId(request);
    const result = await analyseArticle({
      completion_id: request.request?.completion_id ?? "",
      app_url: request.app_url,
      ...(request.context ? { context: request.context } : {}),
      ...(request.env ? { env: request.env } : {}),
      args: { itemId: args.itemId, article: args.article },
      user,
      ...(projectId ? { projectId } : {}),
    });

    return {
      status: "success",
      name: analyseArticleDescriptor.name,
      content:
        result.analysis?.content ??
        result.message ??
        "Analysed the article. The result is in Files.",
      data: {
        ...(result.outputId ? { outputId: result.outputId } : {}),
        ...(result.itemId ? { itemId: result.itemId } : {}),
        ...(result.analysis?.data ? { analysis: result.analysis.data } : {}),
      },
    } satisfies IFunctionResponse;
  },
};
