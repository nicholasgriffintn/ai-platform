import type { ModelConfig } from "../../types";
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
import { mistralModelConfig } from "./mistral";
import { ollamaModelConfig } from "./ollama";
import { openaiModelConfig } from "./openai";
import { openrouterModelConfig } from "./openrouter";
import { perplexityModelConfig } from "./perplexity";
import { togetherAiModelConfig } from "./together-ai";
import { workersAiModelConfig } from "./workersai";

import type { IEnv, ModelConfigItem } from "../../types";
import { Database } from "../database";

export {
  availableCapabilities,
  availableModelTypes,
  defaultModel,
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
  const freeModels = getFreeModels();
  const freeModelIds = new Set(Object.keys(freeModels));
  const alwaysEnabledProvidersEnvVar = env.ALWAYS_ENABLED_PROVIDERS;
  const alwaysEnabledProviders = new Set(
    alwaysEnabledProvidersEnvVar?.split(",") || [],
  );

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
    console.error(`Error during model filtering for user ${userId}: ${error}`);
    // Fallback to free models in case of error
    const fallbackModels: Record<string, ModelConfigItem> = {};
    for (const modelId in allModels) {
      if (freeModelIds.has(modelId)) {
        fallbackModels[modelId] = allModels[modelId];
      }
    }
    return fallbackModels;
  }
}
