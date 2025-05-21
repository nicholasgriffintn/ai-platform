import { sanitiseInput } from "~/lib/chat/utils";
import { getAuxiliaryModelForRetrieval } from "~/lib/models";
import { analyseArticlePrompt } from "~/lib/prompts";
import { AIProviderFactory } from "~/lib/providers/factory";
import { AppDataRepository } from "~/repositories/AppDataRepository";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extractQuotes } from "~/utils/extract";
import { verifyQuotes } from "~/utils/verify";

export interface Params {
  article: string;
  itemId: string;
}

export interface AnalyseSuccessResponse {
  status: "success";
  message?: string;
  appDataId?: string;
  itemId?: string;
  analysis?: { content: string; data: any };
}

export async function analyseArticle({
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
}): Promise<AnalyseSuccessResponse> {
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

  try {
    const sanitisedArticle = sanitiseInput(args.article);

    const { model: modelToUse, provider: providerToUse } =
      await getAuxiliaryModelForRetrieval(env, user);
    const provider = AIProviderFactory.getProvider(providerToUse);
    const analysisData = await provider.getResponse({
      completion_id,
      app_url,
      model: modelToUse,
      messages: [
        {
          role: "user",
          content: analyseArticlePrompt(sanitisedArticle),
        },
      ],
      env: env,
      user,
    });

    const quotes = extractQuotes(analysisData.content);
    const verifiedQuotes = verifyQuotes(sanitisedArticle, quotes);

    const analysisResult = {
      content: analysisData.content,
      model: analysisData.model,
      id: analysisData.id,
      citations: analysisData.citations,
      log_id: analysisData.log_id,
      verifiedQuotes,
    };

    const appDataRepo = new AppDataRepository(env);
    const appData = {
      originalArticle: args.article,
      analysis: analysisResult,
      title: `Analysis: ${args.article.substring(0, 80)}...`,
    };
    const savedData = await appDataRepo.createAppDataWithItem(
      user.id,
      "articles",
      args.itemId,
      "analysis",
      appData,
    );

    return {
      status: "success",
      message: "Article analysed and saved.",
      appDataId: savedData.id,
      itemId: args.itemId,
      analysis: {
        content: analysisResult.content,
        data: { ...analysisResult, verifiedQuotes },
      },
    };
  } catch (error) {
    console.error("Error during article analysis or saving:", error);
    if (error instanceof AssistantError) {
      throw error;
    }
    throw new AssistantError(
      "Failed to analyse article",
      ErrorType.UNKNOWN_ERROR,
      undefined,
      error,
    );
  }
}
