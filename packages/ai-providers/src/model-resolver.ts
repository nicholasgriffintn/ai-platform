import {
  findModelConfigByMatchingModel,
  getModelConfigById,
  getModels,
  resolveDefaultChatModel,
} from "@ngriffin_uk/polychat-ai-models";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderModelResolver } from "./host.js";
import { isProviderPlatformEnabled } from "./platform-credentials.js";

export function createCatalogueModelResolver(): ProviderModelResolver {
  const getModelConfig: ProviderModelResolver["getModelConfig"] = async (model, _env, provider) => {
    if (!model) {
      return undefined;
    }

    const config = getModelConfigById(model);

    if (config && (!provider || config.provider === provider)) {
      return config;
    }

    return provider ? (findModelConfigByMatchingModel(model, provider) ?? undefined) : config;
  };

  const getModelConfigByMatchingModel: ProviderModelResolver["getModelConfigByMatchingModel"] =
    async (matchingModel, _env, provider) =>
      findModelConfigByMatchingModel(matchingModel, provider);

  const findModelConfig: ProviderModelResolver["findModelConfig"] = async (
    model,
    env,
    provider,
    userId,
  ) =>
    (await getModelConfig(model, env, provider, userId)) ??
    (await getModelConfigByMatchingModel(model, env, provider, userId)) ??
    null;

  const defaultChatModel = () => resolveDefaultChatModel(getModels(), undefined);

  return {
    getModelConfig,
    getModelConfigByModel: async (model) => getModelConfigById(model),
    getModelConfigByMatchingModel,
    findModelConfig,
    resolveModelConfig: async (model, env, provider, userId) => {
      const config = await findModelConfig(model, env, provider, userId);

      if (!config) {
        throw new AssistantError(`Model ${model} not found`, ErrorType.PARAMS_ERROR);
      }

      return config;
    },
    resolveModelProvider: async ({ model, provider, defaultProvider }) => {
      if (model) {
        const matched =
          getModelConfigById(model) ?? findModelConfigByMatchingModel(model, provider);

        if (matched?.provider) {
          return matched.provider;
        }
      }

      return provider || defaultProvider;
    },
    getAuxiliaryGuardrailsModel: async () => {
      const selected = defaultChatModel();

      return { model: selected.config.matchingModel, provider: selected.config.provider };
    },
    getAuxiliaryDecisionModel: async (env) => {
      const config = getModelConfigById("jev-latest");

      if (!config || !isProviderPlatformEnabled(config.provider, env)) {
        return null;
      }

      return { model: config.matchingModel, provider: config.provider };
    },
    getAuxiliarySpeechModel: async () => {
      const config = getModelConfigById("whisper");

      if (!config) {
        throw new AssistantError(
          "No transcription model is configured",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      return {
        model: config.matchingModel,
        provider: config.provider,
        transcriptionProvider: "workers",
      };
    },
  };
}
