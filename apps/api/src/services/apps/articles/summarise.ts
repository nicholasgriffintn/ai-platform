import { sanitiseInput } from "~/lib/chat/utils";
import { getAuxiliaryModelForRetrieval } from "~/lib/models";
import { summariseArticlePrompt } from "~/lib/prompts";
import { AIProviderFactory } from "~/lib/providers/factory";
import { AppDataRepository } from "~/repositories/AppDataRepository";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extractQuotes } from "~/utils/extract";
import { getLogger } from "~/utils/logger";
import { verifyQuotes } from "~/utils/verify";

const logger = getLogger({ prefix: "services/apps/articles/summarise" });

export interface Params {
  article: string;
  itemId: string;
}

export interface SummariseSuccessResponse {
  status: "success";
  message?: string;
  appDataId?: string;
  itemId?: string;
  summary?: { content: string; data: any };
}

export async function summariseArticle({
  completion_id,
  app_url,
  env,
  args,
  user,
}: {
  completion_id: string;
  app_url: string | undefined;
  env: IEnv;
  args: Params;
  user: IUser;
}): Promise<SummariseSuccessResponse> {
  if (!user.id) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }
  if (!args.itemId) {
    throw new AssistantError("Item ID is required", ErrorType.PARAMS_ERROR);
  }
  if (!args.article) {
    throw new AssistantError(
      "Article content is required",
      ErrorType.PARAMS_ERROR,
    );
  }

  const sanitisedArticle = sanitiseInput(args.article);

  try {
    const { model: modelToUse, provider: providerToUse } =
      await getAuxiliaryModelForRetrieval(env, user);
    const provider = AIProviderFactory.getProvider(providerToUse);

    const summaryGenData = await provider.getResponse({
      completion_id,
      app_url,
      model: modelToUse,
      messages: [
        {
          role: "user",
          content: summariseArticlePrompt(sanitisedArticle),
        },
      ],
      env: env,
      user,
    });

    const summaryGenDataContent =
      summaryGenData.content || summaryGenData.response;

    if (!summaryGenDataContent) {
      throw new AssistantError(
        "Summary content was empty",
        ErrorType.PARAMS_ERROR,
      );
    }

    const quotes = extractQuotes(summaryGenDataContent);
    const verifiedQuotes = verifyQuotes(args.article, quotes);

    const summaryResult = {
      content: summaryGenDataContent,
      model: modelToUse,
      id: summaryGenData.id,
      citations: summaryGenData.citations,
      log_id: summaryGenData.log_id,
      verifiedQuotes,
    };

    const appDataRepo = new AppDataRepository(env);
    const appData = {
      originalArticle: args.article,
      summary: summaryResult,
      title: `Summary: ${args.article.substring(0, 80)}...`,
    };

    const savedData = await appDataRepo.createAppDataWithItem(
      user.id,
      "articles",
      args.itemId,
      "summary",
      appData,
    );

    return {
      status: "success",
      message: "Article summarised and saved.",
      appDataId: savedData.id,
      itemId: args.itemId,
      summary: {
        content: summaryResult.content,
        data: { ...summaryResult, verifiedQuotes },
      },
    };
  } catch (error) {
    logger.error("Error during article summary or saving:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    if (error instanceof AssistantError) {
      throw error;
    }
    throw new AssistantError(
      "Failed to summarise article",
      ErrorType.UNKNOWN_ERROR,
      undefined,
      error,
    );
  }
}

/**
 * Clean up existing article analyses and summaries for a session
 * @param env The environment
 * @param userId The user ID
 * @param itemId The article item ID
 */
export const cleanupArticleSession = async (
  env: IEnv,
  userId: number,
  itemId: string,
): Promise<void> => {
  const appDataRepo = new AppDataRepository(env);

  // Clean up existing analyses and summaries
  await appDataRepo.deleteAppDataByUserAppAndItem(
    userId,
    "articles",
    itemId,
    "analysis",
  );

  await appDataRepo.deleteAppDataByUserAppAndItem(
    userId,
    "articles",
    itemId,
    "summary",
  );
};
