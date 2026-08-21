import type { ModelConfigInfo, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import type { ValidationContext } from "~/lib/chat/validation/ValidationPipeline";
import { findModelConfig } from "~/lib/providers/models";
import type { CoreChatOptions, IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/preparation/model-configs" });

const modelConfigCache = new Map<string, Promise<ModelConfigItem | null>>();

export function clearModelConfigCache(): void {
  modelConfigCache.clear();
}

export function getCachedModelConfig(
  model: string,
  env: IEnv,
  provider?: string,
  userId?: number,
): Promise<ModelConfigItem | null> {
  const cacheKey = [userId ?? "anonymous", provider ?? "any", model].join(":");
  const cached = modelConfigCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const fetchPromise = (async () => {
    try {
      const config = await findModelConfig(model, env, provider, userId);

      if (!config) {
        modelConfigCache.delete(cacheKey);

        return null;
      }

      return config;
    } catch (error) {
      modelConfigCache.delete(cacheKey);
      throw error;
    }
  })();

  modelConfigCache.set(cacheKey, fetchPromise);

  return fetchPromise;
}

export async function buildModelConfigs(
  options: CoreChatOptions,
  validationContext: ValidationContext,
): Promise<ModelConfigInfo[]> {
  const { env, provider: requestedProvider } = options;
  const user = options.context?.user;
  const { selectedModels, modelConfig: primaryModelConfig } = validationContext;

  if (!selectedModels || selectedModels.length === 0) {
    throw new AssistantError(
      "No selected models available from validation context",
      ErrorType.PARAMS_ERROR,
    );
  }

  const successfulConfigs: ModelConfigInfo[] = [];
  const seenModels = new Set<string>();
  const addConfig = (config: ModelConfigItem | null) => {
    if (!config) {
      return;
    }

    const modelKey = `${config.provider}::${config.matchingModel}`;

    if (seenModels.has(modelKey)) {
      return;
    }

    seenModels.add(modelKey);
    successfulConfigs.push({
      model: config.matchingModel,
      provider: config.provider,
      displayName: config.name || config.matchingModel,
    });
  };

  const shouldSkipPrimaryFetch = Boolean(primaryModelConfig);

  if (primaryModelConfig) {
    addConfig(primaryModelConfig);
  }

  const modelsToFetch = shouldSkipPrimaryFetch ? selectedModels.slice(1) : selectedModels.slice();

  const configResults = await Promise.allSettled(
    modelsToFetch.map((model) => getCachedModelConfig(model, env, requestedProvider, user?.id)),
  );

  configResults.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      addConfig(result.value);

      return;
    }

    logger.warn("Failed to get model configuration", {
      model: modelsToFetch[index],
      error: result.status === "rejected" ? result.reason : "No config returned",
    });
  });

  if (successfulConfigs.length === 0) {
    throw new AssistantError(
      "No valid model configurations available",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return successfulConfigs;
}
