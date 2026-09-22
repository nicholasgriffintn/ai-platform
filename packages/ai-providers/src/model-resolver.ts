import {
  findModelConfigByMatchingModel,
  getModelConfigById,
  getModels,
  getModelsByOutputModality,
  resolveDefaultChatModel,
} from "@ngriffin_uk/polychat-ai-models";
import {
  getSystemModelLineup,
  modelHasOutputModality,
  type ModelConfig,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderModelResolver, RerankingModelSelection } from "./host.js";
import { isProviderPlatformEnabled } from "./platform-credentials.js";

export function isRerankingModelRuntimeAvailable(
  model: Pick<ModelConfigItem, "provider">,
  env: Record<string, unknown>,
): boolean {
  if (["workers", "workers-ai"].includes(model.provider)) {
    return Boolean(env.AI);
  }

  return isProviderPlatformEnabled(model.provider, env);
}

export function selectRerankingModel(
  models: ModelConfig,
  env: Record<string, unknown>,
  selection: RerankingModelSelection = {},
): { model: string; provider: string } | null {
  const availableModels = Object.entries(models).filter(
    ([, model]) =>
      (!selection.provider || model.provider === selection.provider) &&
      modelHasOutputModality(model, "reranking") &&
      isRerankingModelRuntimeAvailable(model, env),
  );

  if (selection.model) {
    const selected = availableModels.find(
      ([id, model]) => id === selection.model || model.matchingModel === selection.model,
    );

    return selected ? { model: selected[1].matchingModel, provider: selected[1].provider } : null;
  }

  for (const candidate of getSystemModelLineup("reranking").candidates) {
    const match = availableModels.find(
      ([id, model]) =>
        model.provider === candidate.provider &&
        (id === candidate.model || model.matchingModel === candidate.model),
    );

    if (match) {
      return { model: match[1].matchingModel, provider: match[1].provider };
    }
  }

  return null;
}

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
    resolveRerankingModel: async (env, _user, selection) =>
      selectRerankingModel(getModelsByOutputModality("reranking"), env, selection),
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
