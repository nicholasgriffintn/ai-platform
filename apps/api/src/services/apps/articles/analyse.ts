import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { ai } from "~/lib/ai";
import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { findModelConfig, getAuxiliaryModelForRetrieval } from "~/services/models/resolve";
import { createExecutionOutputProvenance } from "~/services/outputs/provenance";
import type { IEnv, IUser } from "~/types";
import { extractQuotes } from "~/utils/extract";
import { verifyQuotes } from "~/utils/verify";

import { analyseArticlePrompt } from "./prompts";

const logger = getLogger({ prefix: "services/apps/articles/analyse" });

export interface Params {
  article: string;
  itemId: string;
}

export interface AnalyseSuccessResponse {
  status: "success";
  message?: string;
  outputId?: string;
  itemId?: string;
  analysis?: { content: string; data: any };
}

export async function analyseArticle({
  completion_id,
  app_url,
  context,
  env,
  args,
  user,
  projectId,
}: {
  completion_id: string;
  app_url: string | undefined;
  context?: ServiceContext;
  env?: IEnv;
  args: Params;
  user: IUser;
  projectId?: string;
}): Promise<AnalyseSuccessResponse> {
  if (!user.id) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }

  if (!args.itemId) {
    throw new AssistantError("Item ID is required", ErrorType.PARAMS_ERROR);
  }

  if (!args.article) {
    throw new AssistantError("Article content is required", ErrorType.PARAMS_ERROR);
  }

  try {
    const serviceContext =
      context ??
      (env
        ? createServiceContext({
            env,
            user,
          })
        : null);

    if (!serviceContext) {
      throw new AssistantError("Service context is required", ErrorType.CONFIGURATION_ERROR);
    }

    const sanitisedArticle = sanitiseInput(args.article);

    const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModelForRetrieval(
      serviceContext.env,
      user,
    );
    const modelConfig = await findModelConfig(modelToUse, serviceContext.env, providerToUse);
    const analysisData = await ai.complete({
      env: serviceContext.env,
      user,
      model: modelToUse,
      provider: providerToUse,
      completion_id,
      app_url,
      prompt: analyseArticlePrompt(sanitisedArticle, {
        modelId: modelToUse,
        modelConfig,
      }),
    });

    if (!analysisData.text) {
      throw new AssistantError("Analysis content was empty", ErrorType.PARAMS_ERROR);
    }

    const quotes = extractQuotes(analysisData.text);
    const verifiedQuotes = verifyQuotes(sanitisedArticle, quotes);

    const analysisResult = {
      content: analysisData.text,
      model: modelToUse,
      id: analysisData.id,
      citations: analysisData.citations,
      log_id: analysisData.logId,
      verifiedQuotes,
    };

    serviceContext.ensureDatabase();
    const outputRepo = serviceContext.repositories.outputs;
    const outputContent = {
      originalArticle: args.article,
      analysis: analysisResult,
      title: `Analysis: ${args.article.substring(0, 80)}...`,
    };
    const savedData = await outputRepo.createOutput({
      createdByUserId: user.id,
      projectId,
      capabilityId: "articles",
      groupId: args.itemId,
      kind: "analysis",
      title: outputContent.title,
      content: outputContent,
      provenance: await createExecutionOutputProvenance(serviceContext, {
        modelId: modelToUse,
        provider: providerToUse,
      }),
    });

    return {
      status: "success",
      message: "Article analysed and saved.",
      outputId: savedData.id,
      itemId: args.itemId,
      analysis: {
        content: analysisResult.content,
        data: { ...analysisResult, verifiedQuotes },
      },
    };
  } catch (error) {
    logger.error("Error during article analysis or saving:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
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
