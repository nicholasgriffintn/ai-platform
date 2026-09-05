import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { createExecutionOutputProvenance } from "~/lib/provenance/output";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { findModelConfig, getAuxiliaryModelForRetrieval } from "~/lib/providers/models";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extractQuotes } from "~/utils/extract";
import { getLogger } from "~/utils/logger";
import { sanitiseInput } from "~/utils/sanitise";
import { verifyQuotes } from "~/utils/verify";

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

    const { model: modelToUse, provider: providerToUse } = await getAuxiliaryModelForRetrieval(
      serviceContext.env,
      user,
    );
    const modelConfig = await findModelConfig(modelToUse, serviceContext.env, providerToUse);
    const provider = getChatProvider(providerToUse, {
      env: serviceContext.env,
      user,
    });

    const summaryGenData = await provider.getResponse({
      completion_id,
      app_url,
      model: modelToUse,
      messages: [
        {
          role: "user",
          content: summariseArticlePrompt(sanitisedArticle, {
            modelId: modelToUse,
            modelConfig,
          }),
        },
      ],
      env: serviceContext.env,
      context: serviceContext,
    });

    const summaryGenDataContent = summaryGenData.content || summaryGenData.response;

    if (!summaryGenDataContent) {
      throw new AssistantError("Summary content was empty", ErrorType.PARAMS_ERROR);
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
