import type { ChatMode } from "./chat-modes";
import type { ModelCatalogItem, ModelConfig, ModelConfigItem, ModelModality } from "./models";
import type { ReasoningEffort } from "./reasoning";

export const EMPTY_MODEL_CONFIG: ModelConfig = {};
const LOCAL_MODEL_PROVIDER = "web-llm";
const DEFAULT_MODALITIES: ModelModality[] = ["text"];

export interface ModelInteractionCapabilities {
  isImageModel: boolean;
  isMultimodalModel: boolean;
  isTextToImageOnlyModel: boolean;
  supportsAudio: boolean;
  supportsCode: boolean;
  supportsCodeExecution: boolean;
  supportsDocuments: boolean;
  supportsSearchGrounding: boolean;
  supportsToolCalls: boolean;
}

const EMPTY_MODEL_INTERACTION_CAPABILITIES: ModelInteractionCapabilities = {
  isImageModel: false,
  isMultimodalModel: false,
  isTextToImageOnlyModel: false,
  supportsAudio: false,
  supportsCode: false,
  supportsCodeExecution: false,
  supportsDocuments: false,
  supportsSearchGrounding: false,
  supportsToolCalls: false,
};

export function getAvailableModels(
  apiModels: ModelConfig,
  shouldIncludeWebLLM = true,
  webLLMModels: ModelConfig = {},
) {
  if (!shouldIncludeWebLLM) {
    return apiModels;
  }

  return { ...webLLMModels, ...apiModels };
}

export function getFeaturedModelIds(models: ModelConfig) {
  return Object.entries(models).reduce<Record<string, ModelCatalogItem>>((acc, [key, model]) => {
    if (model.isFeatured && isActiveModel(model)) {
      acc[key] = {
        ...model,
        id: key,
      };
    }

    return acc;
  }, {});
}

export function getModelDisplayName(model: Pick<ModelConfigItem, "matchingModel" | "name">) {
  return model.name || model.matchingModel;
}

export function doesModelMatchId(
  model: Pick<ModelConfigItem, "id" | "matchingModel" | "name">,
  modelId?: string | null,
) {
  return Boolean(
    modelId && (model.id === modelId || model.matchingModel === modelId || model.name === modelId),
  );
}

export function createModelReferenceMap(models: ModelConfig) {
  const modelReferences = new Map<string, ModelConfigItem>();

  for (const model of Object.values(models)) {
    for (const modelReference of [model.id, model.matchingModel, model.name]) {
      if (!modelReference || modelReferences.has(modelReference)) {
        continue;
      }

      modelReferences.set(modelReference, model);
    }
  }

  return modelReferences;
}

export function getModelByReference(
  modelReferences: ReadonlyMap<string, ModelConfigItem>,
  modelId?: string | null,
) {
  return modelId ? modelReferences.get(modelId) : undefined;
}

export function sortModelsByDisplayName<T extends Pick<ModelConfigItem, "matchingModel" | "name">>(
  models: T[],
) {
  return [...models].sort((a, b) => getModelDisplayName(a).localeCompare(getModelDisplayName(b)));
}

export function getFeaturedModels(models: ModelConfig) {
  return sortModelsByDisplayName(
    Object.entries(models).reduce<ModelCatalogItem[]>((acc, [key, model]) => {
      if (model.isFeatured && isActiveModel(model)) {
        acc.push({
          ...model,
          id: key,
        });
      }

      return acc;
    }, []),
  );
}

export function searchModelList<T extends ModelConfigItem>(models: T[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return sortModelsByDisplayName(
    models.filter((model) => {
      const searchText = [
        model.id,
        model.matchingModel,
        model.name,
        model.provider,
        model.description,
        ...(model.strengths || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(normalizedQuery);
    }),
  );
}

export function getModelProvider(models: ModelConfig, modelId?: string | null) {
  if (!modelId) {
    return undefined;
  }

  return models[modelId]?.provider;
}

export function getModelInputModalities(model?: Pick<ModelConfigItem, "modalities">) {
  return model?.modalities?.input ?? DEFAULT_MODALITIES;
}

export function getModelOutputModalities(model?: Pick<ModelConfigItem, "modalities">) {
  return model?.modalities?.output ?? getModelInputModalities(model);
}

export function modelHasOutputModality(
  model: Pick<ModelConfigItem, "modalities">,
  modality: ModelModality,
) {
  return getModelOutputModalities(model).includes(modality);
}

export function isModelSelectableForAccount(
  model: Pick<ModelConfigItem, "isByokEnabled" | "isFree">,
  isPro: boolean,
) {
  return isPro || Boolean(model.isFree) || Boolean(model.isByokEnabled);
}

export function isActiveModel(model: Pick<ModelConfigItem, "deprecated" | "status">): boolean {
  return !model.deprecated && model.status !== "deprecated";
}

export function getDefaultModelId(models: ModelConfig): string | undefined {
  return Object.entries(models).find(([, model]) => model.isDefault && isActiveModel(model))?.[0];
}

export function isImageGenerationOutputModel(model?: Pick<ModelConfigItem, "modalities">) {
  const outputs = getModelOutputModalities(model);

  return outputs.includes("image") && !outputs.includes("text");
}

export function modelSupportsVisualModality(
  model?: Pick<ModelConfigItem, "modalities" | "multimodal">,
) {
  if (!model) {
    return false;
  }

  return (
    Boolean(model.multimodal) ||
    getModelInputModalities(model).some(
      (modality) => modality === "image" || modality === "video",
    ) ||
    getModelOutputModalities(model).some((modality) => modality === "image" || modality === "video")
  );
}

export function getModelInteractionCapabilities(
  model?: ModelConfigItem,
): ModelInteractionCapabilities {
  if (!model) {
    return EMPTY_MODEL_INTERACTION_CAPABILITIES;
  }

  const inputs = getModelInputModalities(model);
  const outputs = getModelOutputModalities(model);
  const hasTextToImage =
    outputs.includes("image") && !outputs.includes("text") && !inputs.includes("image");
  const hasImageToImage = outputs.includes("image") && inputs.includes("image");
  const hasImageToText = outputs.includes("text") && inputs.includes("image");
  const isTextToImageOnlyModel = hasTextToImage && !hasImageToImage && !hasImageToText;
  const supportsDocuments =
    (Boolean(model.supportsDocuments) || inputs.includes("pdf")) && !isTextToImageOnlyModel;
  const supportsAudio =
    (Boolean(model.supportsAudio) || inputs.includes("audio")) && !isTextToImageOnlyModel;

  return {
    isImageModel: (hasImageToImage || hasImageToText) && !supportsDocuments && !supportsAudio,
    isMultimodalModel: Boolean(model.multimodal) || hasImageToText,
    isTextToImageOnlyModel,
    supportsAudio,
    supportsCode: supportsDocuments,
    supportsCodeExecution: Boolean(model.supportsCodeExecution),
    supportsDocuments,
    supportsSearchGrounding: Boolean(model.supportsSearchGrounding),
    supportsToolCalls: Boolean(model.supportsToolCalls),
  };
}

export function isStealthModel(model?: Pick<ModelConfigItem, "status">) {
  return model?.status === "alpha" || model?.status === "beta";
}

export function isTextOnlyModel(model: ModelConfigItem) {
  const inputs = getModelInputModalities(model);
  const outputs = getModelOutputModalities(model);

  return (
    inputs.length > 0 &&
    outputs.length > 0 &&
    inputs.every((modality) => modality === "text") &&
    outputs.every((modality) => modality === "text")
  );
}

export function isTextInputChatModel(model: ModelConfigItem) {
  const inputs = getModelInputModalities(model);
  const outputs = getModelOutputModalities(model);

  return (
    inputs.includes("text") &&
    outputs.some((modality) => modality === "text" || modality === "image")
  );
}

export function isRealtimeSessionModel(model: ModelConfigItem) {
  return Boolean(model.supportsRealtimeSession);
}

export function getRealtimeSessionModelsByProvider(models: ModelConfig, provider?: string | null) {
  return Object.entries(models).reduce<Record<string, ModelCatalogItem>>((acc, [key, model]) => {
    if (isRealtimeSessionModel(model) && (!provider || model.provider === provider)) {
      acc[key] = {
        ...model,
        id: key,
      };
    }

    return acc;
  }, {});
}

export function getChatAndRealtimeModelsByMode(models: ModelConfig, mode: ChatMode) {
  return {
    ...getModelsByMode(models, mode),
    ...getRealtimeSessionModelsByProvider(models),
  };
}

export function getToolCallModels(models: ModelConfig) {
  return Object.entries(models).reduce<Record<string, ModelCatalogItem>>((acc, [key, model]) => {
    if (model.supportsToolCalls) {
      acc[key] = {
        ...model,
        id: key,
      };
    }

    return acc;
  }, {});
}

export function getModelsByMode(models: ModelConfig, mode: ChatMode) {
  return Object.entries(models).reduce<Record<string, ModelCatalogItem>>((acc, [key, model]) => {
    const outputs = getModelOutputModalities(model);
    const isEmbeddingOnly =
      outputs.length > 0 && outputs.every((modality) => modality === "embedding");
    const isAudioOnly = outputs.length > 0 && outputs.every((modality) => modality === "audio");
    const isVideoOnly = outputs.length > 0 && outputs.every((modality) => modality === "video");
    const isHidden = model.hiddenFromDefaultList;
    const isIncompatible =
      !isTextInputChatModel(model) || isAudioOnly || isVideoOnly || isEmbeddingOnly || isHidden;
    const isLocalModel = model.provider === LOCAL_MODEL_PROVIDER;

    if (!isHidden && !isIncompatible && (mode === "local" ? isLocalModel : !isLocalModel)) {
      acc[key] = {
        ...model,
        id: key,
      };
    }

    return acc;
  }, {});
}

export const DEFAULT_REASONING_EFFORTS: ReasoningEffort[] = ["none", "simulated-thinking"];

export function getReasoningOptions(modelConfig?: ModelConfigItem): ReasoningEffort[] {
  const configuredLevels = modelConfig?.reasoningConfig?.supportedEffortLevels;

  return configuredLevels && configuredLevels.length > 0
    ? configuredLevels
    : DEFAULT_REASONING_EFFORTS;
}

export function getDefaultReasoningEffort(modelConfig?: ModelConfigItem): ReasoningEffort {
  return modelConfig?.reasoningConfig?.defaultEffort ?? "none";
}

export function hasProviderReasoningOptions(modelConfig?: ModelConfigItem): boolean {
  return (
    modelConfig?.reasoningConfig?.supportedEffortLevels?.some(
      (level) => level !== "none" && level !== "simulated-thinking",
    ) ?? false
  );
}

export function formatReasoningLabel(value: ReasoningEffort): string {
  switch (value) {
    case "none":
      return "Instant";
    case "simulated-thinking":
      return "Simulated";
    case "thinking":
      return "Thinking";
    case "default":
      return "Default";
    case "minimal":
      return "Minimal";
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "xhigh":
      return "X-high";
    case "max":
      return "Max";
    default:
      return value;
  }
}
