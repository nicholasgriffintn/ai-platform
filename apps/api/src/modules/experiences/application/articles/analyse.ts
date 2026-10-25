import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { sanitiseInput } from "@ngriffin_uk/polychat-utility-server/sanitise";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  ARTICLE_FRAMING_TIER,
  analyseArticleFraming,
} from "~/modules/experiences/application/articles/framing";
import { renderArticleFraming } from "~/modules/experiences/domain/framing";
import { getTierModel } from "~/modules/models/application/resolve";
import { createExecutionOutputProvenance } from "~/modules/outputs/application/provenance";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import type { IEnv, IUser } from "~/types";

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
  context,
  env,
  args,
  user,
  projectId,
}: {
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
    const [{ framing, missingQuotes, editorial }, tierModel] = await Promise.all([
      analyseArticleFraming(serviceContext, sanitisedArticle),
      getTierModel(serviceContext.env, user, ARTICLE_FRAMING_TIER),
    ]);
    const analysisResult = {
      content: renderArticleFraming(framing),
      framing,
      verifiedQuotes: { verified: missingQuotes.length === 0, missingQuotes },
      ...(editorial ? { editorial } : {}),
    };

    serviceContext.ensureDatabase();
    const outputRepo = serviceContext.repositories.get(OutputRepository);
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
        modelId: tierModel.model,
        provider: tierModel.provider,
      }),
    });

    return {
      status: "success",
      message: "Article analysed and saved.",
      outputId: savedData.id,
      itemId: args.itemId,
      analysis: {
        content: analysisResult.content,
        data: analysisResult,
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
