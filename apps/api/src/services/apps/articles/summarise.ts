import { sanitiseInput } from "~/lib/chat/utils";
import { summariseArticlePrompt } from "~/lib/prompts";
import { AIProviderFactory } from "~/providers/factory";
import { AppDataRepository } from "~/repositories/AppDataRepository";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extractQuotes } from "~/utils/extract";
import { verifyQuotes } from "~/utils/verify";

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
    const provider = AIProviderFactory.getProvider("perplexity-ai");

    const summaryGenData = await provider.getResponse({
      completion_id,
      app_url,
      model: "sonar",
      messages: [
        {
          role: "user",
          content: summariseArticlePrompt(args.article),
        },
      ],
      env: env,
      user,
    });

    const quotes = extractQuotes(summaryGenData.content);
    const verifiedQuotes = verifyQuotes(args.article, quotes);

    const summaryResult = {
      content: summaryGenData.content,
      model: summaryGenData.model,
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
    console.error("Error during article summary or saving:", error);
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
