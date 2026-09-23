import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { ai } from "~/infrastructure/ai";
import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { extractQuotes } from "~/modules/apps/application/articles/extract";
import { verifyQuotes } from "~/modules/apps/application/articles/verify";
import {
  findModelConfig,
  getAuxiliaryModelForRetrieval,
} from "~/modules/models/application/resolve";
import { createExecutionOutputProvenance } from "~/modules/outputs/application/provenance";
import type { IEnv, IUser } from "~/types";

import { summariseArticlePrompt } from "./prompts";

const logger = getLogger({ prefix: "services/apps/articles/summarise" });

export interface Params {
  article: string;
  itemId: string;
}

export interface SummariseSuccessResponse {
  status: "success";
  message?: string;
  outputId?: string;
  itemId?: string;
  summary?: { content: string; data: any };
}

export async function summariseArticle({
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
}): Promise<SummariseSuccessResponse> {
  if (!user.id) {
    throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
  }

  if (!args.itemId) {
    throw new AssistantError("Item ID is required", ErrorType.PARAMS_ERROR);
  }

  if (!args.article) {
    throw new AssistantError("Article content is required", ErrorType.PARAMS_ERROR);
  }

  const sanitisedArticle = sanitiseInput(args.article);

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

    const {
      model: modelToUse,
      provider: providerToUse,
      effort,
    } = await getAuxiliaryModelForRetrieval(serviceContext.env, user);
    const modelConfig = await findModelConfig(modelToUse, serviceContext.env, providerToUse);

    const summaryGenData = await ai.complete({
      env: serviceContext.env,
      user,
      model: modelToUse,
      provider: providerToUse,
      completion_id,
      app_url,
      reasoning_effort: effort,
      disable_functions: true,
      prompt: summariseArticlePrompt(sanitisedArticle, {
        modelId: modelToUse,
        modelConfig,
      }),
    });

    if (!summaryGenData.text) {
      throw new AssistantError("Summary content was empty", ErrorType.PARAMS_ERROR);
    }

    const quotes = extractQuotes(summaryGenData.text);
    const verifiedQuotes = verifyQuotes(args.article, quotes);

    const summaryResult = {
      content: summaryGenData.text,
      model: modelToUse,
      id: summaryGenData.id,
      citations: summaryGenData.citations,
      log_id: summaryGenData.logId,
      verifiedQuotes,
    };

    serviceContext.ensureDatabase();
    const outputRepo = serviceContext.repositories.outputs;
    const outputContent = {
      originalArticle: args.article,
      summary: summaryResult,
      title: `Summary: ${args.article.substring(0, 80)}...`,
    };

    const savedData = await outputRepo.createOutput({
      createdByUserId: user.id,
      projectId,
      capabilityId: "articles",
      groupId: args.itemId,
      kind: "summary",
      title: outputContent.title,
      content: outputContent,
      provenance: await createExecutionOutputProvenance(serviceContext, {
        modelId: modelToUse,
        provider: providerToUse,
      }),
    });

    return {
      status: "success",
      message: "Article summarised and saved.",
      outputId: savedData.id,
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

export const cleanupArticleSession = async (
  context: ServiceContext,
  userId: number,
  itemId: string,
  projectId?: string,
): Promise<void> => {
  context.ensureDatabase();
  const outputRepo = context.repositories.outputs;

  if (projectId) {
    await outputRepo.deleteProjectOutputGroup(projectId, "articles", itemId, "analysis");
    await outputRepo.deleteProjectOutputGroup(projectId, "articles", itemId, "summary");

    return;
  }

  await outputRepo.deletePersonalOutputGroup(userId, "articles", itemId, "analysis");
  await outputRepo.deletePersonalOutputGroup(userId, "articles", itemId, "summary");
};
