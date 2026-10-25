import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import { analyseArticle } from "~/modules/experiences/application/articles/analyse";
import { resolveRequestProjectId } from "~/modules/tools/application/request-context";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  analyse_article as analyseArticleDescriptor,
  type analyseArticleInputSchema,
} from "./definitions/analyse_article";

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
