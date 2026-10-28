import {
  findModelConfigByMatchingModel,
  getModelConfigById,
  getModels,
  resolveDefaultChatModel,
  resolveSystemRoleModel,
} from "@ngriffin_uk/polychat-ai-models";
import {
  getSystemModelLineup,
  findModelByReference,
  modelHasInputModalities,
  modelHasOutputModality,
  type ModelConfig,
  type ModelModality,
  type SystemModelRole,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { toTranscriptionProvider } from "./capabilities/transcription/provider-names.js";
import type { AuxiliaryModelRef, ProviderModelResolver, RerankingModelSelection } from "./host.js";
import { isModelRuntimeAvailable } from "./utils/model-runtime.js";

export function selectRerankingModel(
  models: ModelConfig,
  env: Record<string, unknown>,
  selection: RerankingModelSelection = {},
): { model: string; provider: string } | null {
  const availableModels = Object.entries(models).filter(
    ([, model]) =>
      (!selection.provider || model.provider === selection.provider) &&
      modelHasOutputModality(model, "reranking") &&
      isModelRuntimeAvailable(model, env),
  );

  if (selection.model) {
    const selected = availableModels.find(
      ([id, model]) => id === selection.model || model.matchingModel === selection.model,
    );

    return selected ? { model: selected[1].matchingModel, provider: selected[1].provider } : null;
  }

  const available = Object.fromEntries(availableModels);
  const preferred = getSystemModelLineup("reranking")
    .defaults.map((candidate) => findModelByReference(available, candidate))
    .find((match) => match !== null);
  const selected = preferred?.config ?? availableModels[0]?.[1];

  return selected ? { model: selected.matchingModel, provider: selected.provider } : null;
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

  const resolveRole = (
    env: Record<string, unknown>,
    role: SystemModelRole,
    inputs: readonly ModelModality[] = [],
  ): AuxiliaryModelRef | null => {
    const available = Object.fromEntries(
      Object.entries(getModels()).filter(
        ([, config]) =>
          isModelRuntimeAvailable(config, env) && modelHasInputModalities(config, inputs),
      ),
    );
    const selected = resolveSystemRoleModel(available, role);

    return selected
      ? {
          model: selected.config.matchingModel,
          provider: selected.config.provider,
          effort: selected.effort,
        }
      : null;
  };

  const requireRole = (env: Record<string, unknown>, role: SystemModelRole): AuxiliaryModelRef => {
    const selected = resolveRole(env, role);

    if (!selected) {
      throw new AssistantError(
        `No ${getSystemModelLineup(role).label.toLowerCase()} model is configured`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return selected;
  };

  const resolveTranscriptionModel = (env: Record<string, unknown>) => {
    const selected = requireRole(env, "transcription");

    return { ...selected, transcriptionProvider: toTranscriptionProvider(selected.provider) };
  };

  const resolveReranking = (
    env: Record<string, unknown>,
    selection: RerankingModelSelection = {},
  ) =>
    selection.model || selection.provider
      ? selectRerankingModel(getModels(), env, selection)
      : resolveRole(env, "reranking");

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
    getDefaultChatModel: async () => {
      const selected = defaultChatModel();

      return { model: selected.config.matchingModel, provider: selected.config.provider };
    },
    getSystemModel: async (env, _user, role) => resolveRole(env, role),
    getAuxiliaryModel: async (env) => requireRole(env, "housekeeping"),
    getTitlingModel: async (env) => requireRole(env, "titling"),
    getCompactionModel: async (env) => requireRole(env, "compaction"),
    getAuxiliaryModelForRetrieval: async (env) => requireRole(env, "retrieval"),
    getAuxiliaryGuardrailsModel: async (env) => requireRole(env, "guardrails"),
    getAuxiliaryDecisionModel: async (env, _user, inputs) => resolveRole(env, "decision", inputs),
    resolveRerankingModel: async (env, _user, selection) => resolveReranking(env, selection),
    getAuxiliaryRerankingModel: async (env, _user, selection) => resolveReranking(env, selection),
    getTranscriptionModel: async (env) => resolveTranscriptionModel(env),
    getOcrModel: async (env) => resolveRole(env, "ocr"),
    getImageModel: async (env) => resolveRole(env, "image"),
    getVideoModel: async (env) => resolveRole(env, "video"),
    getMusicModel: async (env) => resolveRole(env, "music"),
    getFimModel: async (env) => resolveRole(env, "fim"),
    getNextEditModel: async (env) => resolveRole(env, "nextEdit"),
    getApplyEditModel: async (env) => resolveRole(env, "applyEdit"),
  };
}
