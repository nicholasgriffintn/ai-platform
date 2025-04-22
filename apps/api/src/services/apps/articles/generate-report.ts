import { generateArticleReportPrompt } from "~/lib/prompts";
import { AIProviderFactory } from "~/providers/factory";
import { AppDataRepository } from "~/repositories/AppDataRepository";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extractQuotes } from "~/utils/extract";
import { verifyQuotes } from "~/utils/verify";

export interface Params {
  itemId: string;
}

export interface GenerateReportSuccessResponse {
  status: "success";
  message?: string;
  appDataId?: string;
  itemId?: string;
}

export async function generateArticlesReport({
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
}): Promise<GenerateReportSuccessResponse> {
  if (!user.id) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }
  if (!args.itemId) {
    throw new AssistantError("Item ID is required", ErrorType.PARAMS_ERROR);
  }

  try {
    const appDataRepo = new AppDataRepository(env);

    const relatedItems = await appDataRepo.getAppDataByUserAppAndItem(
      user.id,
      "articles",
      args.itemId,
    );

    const analysisItems = relatedItems.filter(
      (item) => item.item_type === "analysis",
    );

    if (analysisItems.length === 0) {
      throw new AssistantError(
        `No analysis data found for itemId: ${args.itemId}`,
        ErrorType.NOT_FOUND,
      );
    }

    const combinedArticles = analysisItems
      .map((item) => JSON.parse(item.data || "{}").originalArticle)
      .filter((content): content is string => !!content)
      .join("\n\n---\n\n");

    if (!combinedArticles || combinedArticles.trim().length === 0) {
      throw new AssistantError(
        "Could not extract article content from saved analysis data.",
        ErrorType.INTERNAL_ERROR,
      );
    }

    const provider = AIProviderFactory.getProvider("perplexity-ai");

    const reportGenData = await provider.getResponse({
      completion_id,
      app_url,
      model: "sonar",
      messages: [
        {
          role: "user",
          content: generateArticleReportPrompt(combinedArticles),
        },
      ],
      env: env,
      user,
    });

    const quotes = extractQuotes(reportGenData.content);
    const verifiedQuotes = verifyQuotes(combinedArticles, quotes);

    const reportResult = {
      content: reportGenData.content,
      model: reportGenData.model,
      id: reportGenData.id,
      citations: reportGenData.citations,
      log_id: reportGenData.log_id,
      verifiedQuotes: verifiedQuotes,
    };

    const reportAppData = {
      sourceItemIds: analysisItems.map((item) => item.id),
      report: reportResult,
      title: `Report for Analysis Session ${args.itemId} (${analysisItems.length} articles)`,
    };

    const savedReport = await appDataRepo.createAppDataWithItem(
      user.id,
      "articles",
      args.itemId,
      "report",
      reportAppData,
    );

    return {
      status: "success",
      message: "Article report generated and saved.",
      appDataId: savedReport.id,
      itemId: args.itemId,
    };
  } catch (error) {
    console.error("Error generating article report:", error);
    if (error instanceof AssistantError) {
      throw error;
    }
    throw new AssistantError(
      "Failed to generate report",
      ErrorType.UNKNOWN_ERROR,
      undefined,
      error,
    );
  }
}
