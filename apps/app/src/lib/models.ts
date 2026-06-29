import type {
	ModelCatalogItem,
	ModelConfig,
	ModelConfigItem,
	ModelModality,
} from "@assistant/schemas";
import type { ChatMode } from "~/types";

export const defaultModel = "deepseek-v4-flash";
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
	return Object.entries(models).reduce(
		(acc, [key, model]) => {
			if (model.isFeatured) {
				acc[key] = {
					...model,
					id: key,
				};
			}
			return acc;
		},
		{} as Record<string, ModelCatalogItem>,
	);
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
			if (model.isFeatured) {
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
	if (!modelId) return undefined;
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
	const supportsDocuments = Boolean(model.supportsDocuments) && !isTextToImageOnlyModel;
	const supportsAudio = Boolean(model.supportsAudio) && !isTextToImageOnlyModel;

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
	return model?.status === "alpha";
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
	return Object.entries(models).reduce(
		(acc, [key, model]) => {
			if (isRealtimeSessionModel(model) && (!provider || model.provider === provider)) {
				acc[key] = {
					...model,
					id: key,
				};
			}
			return acc;
		},
		{} as Record<string, ModelCatalogItem>,
	);
}

export function getChatAndRealtimeModelsByMode(models: ModelConfig, mode: ChatMode) {
	return {
		...getModelsByMode(models, mode),
		...getRealtimeSessionModelsByProvider(models),
	};
}

export function getToolCallModels(models: ModelConfig) {
	return Object.entries(models).reduce(
		(acc, [key, model]) => {
			if (model.supportsToolCalls) {
				acc[key] = {
					...model,
					id: key,
				};
			}
			return acc;
		},
		{} as Record<string, ModelCatalogItem>,
	);
}

export function getModelsByMode(models: ModelConfig, mode: ChatMode) {
	return Object.entries(models).reduce(
		(acc, [key, model]) => {
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
		},
		{} as Record<string, ModelCatalogItem>,
	);
}
