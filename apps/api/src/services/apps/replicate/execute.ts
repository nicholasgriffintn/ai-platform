import { getModelConfigByModel } from "~/lib/models";
import { validateReplicatePayload } from "~/lib/models/utils/replicateValidation";
import { AIProviderFactory } from "~/lib/providers/factory";
import { RepositoryManager } from "~/repositories";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { generateId } from "~/utils/id";

const logger = getLogger({ prefix: "services/apps/replicate/execute" });

export interface ExecuteReplicateModelParams {
  modelId: string;
  input: Record<string, any>;
}

export interface ExecuteReplicateModelRequest {
  env: IEnv;
  params: ExecuteReplicateModelParams;
  user: IUser;
  app_url?: string;
}

export const executeReplicateModel = async (
  req: ExecuteReplicateModelRequest,
) => {
  const { params, env, user, app_url } = req;

  if (!params.modelId || !params.input) {
    throw new AssistantError(
      "Missing model ID or input parameters",
      ErrorType.PARAMS_ERROR,
    );
  }

  if (!user?.id) {
    throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
  }

  try {
    const modelConfig = await getModelConfigByModel(params.modelId);

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.modelId}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    validateReplicatePayload({
      payload: params.input,
      schema: modelConfig.replicateInputSchema,
      modelName: modelConfig.name || params.modelId,
    });

    const provider = AIProviderFactory.getProvider(
      modelConfig.provider || "replicate",
    );

    const predictionId = generateId();

    const predictionData = await provider.getResponse({
      completion_id: predictionId,
      app_url,
      model: modelConfig.matchingModel,
      messages: [
        {
          role: "user",
          content: params.input.prompt,
        },
      ],
      body: {
        input: params.input,
      },
      env,
      user,
      store: false,
    });

    const isAsync = predictionData?.status === "in_progress";

    const repositories = RepositoryManager.getInstance(env);

    const appData = {
      modelId: params.modelId,
      modelName: modelConfig.name,
      input: params.input,
      predictionData,
      status: isAsync ? "processing" : "completed",
      createdAt: new Date().toISOString(),
    };

    const stored = await repositories.appData.createAppDataWithItem(
      user.id,
      "replicate",
      predictionId,
      "prediction",
      appData,
    );

    if (!stored?.id) {
      throw new AssistantError(
        "Failed to store prediction data",
        ErrorType.STORAGE_ERROR,
      );
    }

    return {
      status: "success",
      content: isAsync
        ? `Prediction started: ${predictionId}`
        : `Prediction completed: ${predictionId}`,
      data: {
        id: stored.id,
        ...stored,
      },
    };
  } catch (error) {
    logger.error("Failed to execute Replicate model:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
      modelId: params.modelId,
    });
    throw error;
  }
};
