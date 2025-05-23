import type { IUser, ModelConfig } from "~/types";
import {
  type availableCapabilities,
  type availableModelTypes,
  defaultModel,
} from "./constants";

import { anthropicModelConfig } from "./anthropic";
import { bedrockModelConfig } from "./bedrock";
import { deepseekModelConfig } from "./deepseek";
import { fireworksModelConfig } from "./fireworks";
import { githubModelsConfig } from "./githubmodels";
import { googleAiStudioModelConfig } from "./google-ai-studio";
import { grokModelConfig } from "./grok";
import { groqModelConfig } from "./groq";
import { huggingfaceModelConfig } from "./huggingface";
import { hyperbolicModelConfig } from "./hyperbolic";
import { mistralModelConfig } from "./mistral";
import { ollamaModelConfig } from "./ollama";
import { openaiModelConfig } from "./openai";
import { openrouterModelConfig } from "./openrouter";
import { perplexityModelConfig } from "./perplexity";
import { togetherAiModelConfig } from "./together-ai";
import { v0ModelConfig } from "./v0";
import { workersAiModelConfig } from "./workersai";

import { Database } from "~/lib/database";
import type { IEnv, ModelConfigItem } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "MODELS" });

export {
  availableCapabilities,
  availableModelTypes,
  defaultModel,
  defaultProvider,
} from "./constants";

const modelConfig: ModelConfig = {
  ...openaiModelConfig,
  ...anthropicModelConfig,
  ...mistralModelConfig,
  ...ollamaModelConfig,
  ...bedrockModelConfig,
  ...deepseekModelConfig,
  ...githubModelsConfig,
  ...grokModelConfig,
  ...groqModelConfig,
  ...huggingfaceModelConfig,
  ...openrouterModelConfig,
  ...perplexityModelConfig,
  ...workersAiModelConfig,
  ...togetherAiModelConfig,
  ...googleAiStudioModelConfig,
  ...fireworksModelConfig,
  ...hyperbolicModelConfig,
  ...v0ModelConfig,
};

export function getModelConfig(model?: string) {
  return (model && modelConfig[model]) || modelConfig[defaultModel];
}

export function getModelConfigByModel(model: string) {
  return model && modelConfig[model as keyof typeof modelConfig];
}

export function getMatchingModel(model: string = defaultModel) {
  return model && getModelConfig(model).matchingModel;
}

export function getModelConfigByMatchingModel(matchingModel: string) {
  for (const model in modelConfig) {
    if (
      modelConfig[model as keyof typeof modelConfig].matchingModel ===
      matchingModel
    ) {
      return modelConfig[model as keyof typeof modelConfig];
    }
  }
  return null;
}

export function getModels() {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (!model.beta) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
}

export function getFreeModels() {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (model.isFree) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
}

export function getFeaturedModels() {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (model.isFeatured) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
}

export function getIncludedInRouterModels() {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (model.includedInRouter) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
}

export function getModelsByCapability(capability: string) {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (
        model.strengths?.includes(
          capability as (typeof availableCapabilities)[number],
        )
      ) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
}

export function getModelsByType(type: string) {
  return Object.entries(modelConfig).reduce(
    (acc, [key, model]) => {
      if (model.type?.includes(type as (typeof availableModelTypes)[number])) {
        acc[key] = model;
      }
      return acc;
    },
    {} as typeof modelConfig,
  );
}

export async function filterModelsForUserAccess(
  allModels: Record<string, ModelConfigItem>,
  env: IEnv,
  userId?: number,
): Promise<Record<string, ModelConfigItem>> {
  const allFreeModels = getFreeModels();
  const alwaysEnabledProvidersEnvVar = env.ALWAYS_ENABLED_PROVIDERS;
  const alwaysEnabledProviders = new Set(
    alwaysEnabledProvidersEnvVar?.split(",") || [],
  );

  const freeModels: Record<string, ModelConfigItem> = {};
  for (const modelId in allFreeModels) {
    const model = allFreeModels[modelId];
    if (alwaysEnabledProviders.has(model.provider)) {
      freeModels[modelId] = model;
    }
  }
  const freeModelIds = new Set(Object.keys(freeModels));

  const filteredModels: Record<string, ModelConfigItem> = {};

  if (!userId) {
    for (const modelId in allModels) {
      if (
        freeModelIds.has(modelId) ||
        alwaysEnabledProviders.has(allModels[modelId].provider)
      ) {
        filteredModels[modelId] = allModels[modelId];
      }
    }
    return filteredModels;
  }

  try {
    const database = Database.getInstance(env);
    const userProviderSettings = await database.getUserProviderSettings(userId);

    const enabledProviders = new Map(
      userProviderSettings
        .filter((p) => p.enabled)
        .map((p) => [p.provider_id, true]),
    );

    for (const modelId in allModels) {
      const model = allModels[modelId];
      const isFree = freeModelIds.has(modelId);
      const isEnabled =
        alwaysEnabledProviders.has(model.provider) ||
        enabledProviders.has(model.provider);

      if (isFree || isEnabled) {
        filteredModels[modelId] = model;
      }
    }

    return filteredModels;
  } catch (error) {
    logger.error(`Error during model filtering for user ${userId}`, { error });
    return freeModels;
  }
}

/**
 * Get the appropriate model to use for auxiliary tasks like summarization,
 * classification, etc., based on which models are available.
 * @param env The environment object
 * @param user Optional user for model access check
 * @returns Object containing model ID and provider
 */
export async function getAuxiliaryModel(
  env: IEnv,
  user?: IUser,
): Promise<{ model: string; provider: string }> {
  let modelToUse = "gemma-3-12b-it";

  const allRouterModels = getIncludedInRouterModels();
  const availableModels = await filterModelsForUserAccess(
    allRouterModels,
    env,
    user?.id,
  );

  const hasGroqModel = Object.keys(availableModels).some(
    (model) => availableModels[model].provider === "groq",
  );

  if (hasGroqModel) {
    modelToUse = "llama-3.3-70b-versatile";
  }

  const modelConfig = getModelConfig(modelToUse);

  return { model: modelConfig.matchingModel, provider: modelConfig.provider };
}

export const getAuxiliaryModelForRetrieval = async (
  env: IEnv,
  user?: IUser,
) => {
  let modelToUse = "gemma-3-12b-it";

  const allRouterModels = getIncludedInRouterModels();
  const availableModels = await filterModelsForUserAccess(
    allRouterModels,
    env,
    user?.id,
  );

  const hasPerplexityModel = Object.keys(availableModels).some(
    (model) => availableModels[model].provider === "perplexity-ai",
  );

  if (hasPerplexityModel) {
    modelToUse = "sonar";
  }

  const modelConfig = getModelConfig(modelToUse);

  return { model: modelConfig.matchingModel, provider: modelConfig.provider };
};

export const getAuxiliaryGuardrailsModel = async (env: IEnv, user?: IUser) => {
  let modelToUse = "@cf/meta/llama-guard-3-8b";

  const allRouterModels = getIncludedInRouterModels();
  const availableModels = await filterModelsForUserAccess(
    allRouterModels,
    env,
    user?.id,
  );

  const hasGroqModel = Object.keys(availableModels).some(
    (model) => availableModels[model].provider === "groq",
  );

  if (hasGroqModel) {
    modelToUse = "llama-guard-3-8b";
  }

  const provider = getModelConfig(modelToUse).provider;

  return { model: modelToUse, provider };
};
