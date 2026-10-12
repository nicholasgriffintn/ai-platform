import {
  findModelConfigByMatchingModel,
  getModelConfigById,
  getModels,
  getModelsByOutputModality,
  resolveDefaultChatModel,
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

  const resolveChatRole = (
    env: Record<string, unknown>,
    role: "housekeeping" | "titling" | "compaction" | "retrieval",
  ): AuxiliaryModelRef => {
    for (const candidate of getSystemModelLineup(role).candidates) {
      const config = findModelByReference(getModels(), candidate)?.config;

      if (config && isModelRuntimeAvailable(config, env)) {
        return { model: config.matchingModel, provider: config.provider, effort: candidate.effort };
      }
    }

    const selected = defaultChatModel();

    return { model: selected.config.matchingModel, provider: selected.config.provider };
  };

  const resolveModalityRole = (
    env: Record<string, unknown>,
    role: SystemModelRole,
    modality:
      | "guardrails"
      | "decision"
      | "ocr"
      | "image"
      | "video"
      | "audio"
      | "speech"
      | "transcription",
    inputs: readonly ModelModality[] = [],
  ): AuxiliaryModelRef | null => {
    const models = getModelsByOutputModality(modality);

    for (const candidate of getSystemModelLineup(role).candidates) {
      const config = findModelByReference(models, candidate)?.config;

      if (
        config &&
        isModelRuntimeAvailable(config, env) &&
        modelHasInputModalities(config, inputs)
      ) {
        return { model: config.matchingModel, provider: config.provider, effort: candidate.effort };
      }
    }

    return null;
  };

  const resolveTranscriptionModel = (env: Record<string, unknown>) => {
    const configured =
      getModelConfigById("whisper") ?? findModelConfigByMatchingModel("whisper", undefined);

    if (configured && isModelRuntimeAvailable(configured, env)) {
      return {
        model: configured.matchingModel,
        provider: configured.provider,
        transcriptionProvider: "workers",
      };
    }

    const fallback = resolveModalityRole(env, "transcription", "transcription");

    if (fallback) {
      return {
        model: fallback.model,
        provider: fallback.provider,
        transcriptionProvider: "workers",
      };
    }

    throw new AssistantError("No transcription model is configured", ErrorType.CONFIGURATION_ERROR);
  };

  const resolveReranking = (
    env: Record<string, unknown>,
    selection: RerankingModelSelection = {},
  ) => selectRerankingModel(getModelsByOutputModality("reranking"), env, selection);

  const resolveCapabilityRole = (
    env: Record<string, unknown>,
    role: "fim" | "nextEdit" | "applyEdit",
  ): AuxiliaryModelRef | null => {
    const capability =
      role === "fim"
        ? "supportsFim"
        : role === "nextEdit"
          ? "supportsNextEdit"
          : "supportsApplyEdit";

    for (const candidate of getSystemModelLineup(role).candidates) {
      const config = findModelByReference(getModels(), candidate)?.config;

      if (config && Boolean(config[capability]) && isModelRuntimeAvailable(config, env)) {
        return { model: config.matchingModel, provider: config.provider, effort: candidate.effort };
      }
    }

    return null;
  };

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
    getSystemModel: async (env, _user, role) => {
      if (
        role === "housekeeping" ||
        role === "titling" ||
        role === "compaction" ||
        role === "retrieval"
      ) {
        return resolveChatRole(env, role);
      }

      if (role === "guardrails") {
        return (
          resolveModalityRole(env, "guardrails", "guardrails") ?? {
            model: defaultChatModel().config.matchingModel,
            provider: defaultChatModel().config.provider,
          }
        );
      }

      if (role === "decision") {
        return resolveModalityRole(env, "decision", "decision");
      }

      if (role === "reranking") {
        return resolveReranking(env);
      }

      if (role === "transcription") {
        const transcription = resolveTranscriptionModel(env);

        return { model: transcription.model, provider: transcription.provider };
      }

      if (role === "ocr") {
        return resolveModalityRole(env, "ocr", "ocr");
      }

      if (role === "image") {
        return resolveModalityRole(env, "image", "image");
      }

      if (role === "video") {
        return resolveModalityRole(env, "video", "video");
      }

      if (role === "music") {
        return resolveModalityRole(env, "music", "audio");
      }

      if (role === "speech") {
        return resolveModalityRole(env, "speech", "speech");
      }

      if (role === "fim" || role === "nextEdit" || role === "applyEdit") {
        return resolveCapabilityRole(env, role);
      }

      return null;
    },
    getAuxiliaryModel: async (env) => resolveChatRole(env, "housekeeping"),
    getTitlingModel: async (env) => resolveChatRole(env, "titling"),
    getCompactionModel: async (env) => resolveChatRole(env, "compaction"),
    getAuxiliaryModelForRetrieval: async (env) => resolveChatRole(env, "retrieval"),
    getAuxiliaryGuardrailsModel: async (env) => {
      return (
        resolveModalityRole(env, "guardrails", "guardrails") ?? {
          model: defaultChatModel().config.matchingModel,
          provider: defaultChatModel().config.provider,
        }
      );
    },
    getAuxiliaryDecisionModel: async (env, _user, inputs) =>
      resolveModalityRole(env, "decision", "decision", inputs),
    resolveRerankingModel: async (env, _user, selection) => resolveReranking(env, selection),
    getAuxiliaryRerankingModel: async (env, _user, selection) => resolveReranking(env, selection),
    getAuxiliarySpeechModel: async (env) => resolveTranscriptionModel(env),
    getOcrModel: async (env) => resolveModalityRole(env, "ocr", "ocr"),
    getImageModel: async (env) => resolveModalityRole(env, "image", "image"),
    getVideoModel: async (env) => resolveModalityRole(env, "video", "video"),
    getMusicModel: async (env) => resolveModalityRole(env, "music", "audio"),
    getSpeechSynthesisModel: async (env) => resolveModalityRole(env, "speech", "speech"),
    getFimModel: async (env) => resolveCapabilityRole(env, "fim"),
    getNextEditModel: async (env) => resolveCapabilityRole(env, "nextEdit"),
    getApplyEditModel: async (env) => resolveCapabilityRole(env, "applyEdit"),
  };
}
