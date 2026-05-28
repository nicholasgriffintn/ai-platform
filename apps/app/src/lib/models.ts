import type { ChatMode, ModelConfig, ModelConfigItem } from "~/types";

export const defaultModel = "deepseek-chat";
const LOCAL_MODEL_PROVIDER = "web-llm";

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
		{} as Record<string, ModelConfigItem>,
	);
}

export function getModelProvider(models: ModelConfig, modelId?: string | null) {
	if (!modelId) return undefined;
	return models[modelId]?.provider;
}

export function isTextOnlyModel(model: ModelConfigItem) {
	const inputs = model.modalities?.input ?? ["text"];
	const outputs = model.modalities?.output ?? inputs;

	return (
		inputs.length > 0 &&
		outputs.length > 0 &&
		inputs.every((modality) => modality === "text") &&
		outputs.every((modality) => modality === "text")
	);
}

export function isTextInputChatModel(model: ModelConfigItem) {
	const inputs = model.modalities?.input ?? ["text"];
	const outputs = model.modalities?.output ?? inputs;

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
		{} as Record<string, ModelConfigItem>,
	);
}

export function getModelsByMode(models: ModelConfig, mode: ChatMode) {
	return Object.entries(models).reduce(
		(acc, [key, model]) => {
			const inputs = model.modalities?.input ?? ["text"];
			const outputs = model.modalities?.output ?? inputs;
			const isEmbeddingOnly =
				outputs.length > 0 && outputs.every((modality) => modality === "embedding");
			const isAudioOnly = outputs.length > 0 && outputs.every((modality) => modality === "audio");
			const isVideoOnly = outputs.length > 0 && outputs.every((modality) => modality === "video");
			const isIncompatible =
				!isTextInputChatModel(model) ||
				isAudioOnly ||
				isVideoOnly ||
				isEmbeddingOnly ||
				model.hiddenFromDefaultList;
			const isLocalModel = model.provider === LOCAL_MODEL_PROVIDER;

			if (!isIncompatible && (mode === "local" ? isLocalModel : !isLocalModel)) {
				acc[key] = {
					...model,
					id: key,
				};
			}
			return acc;
		},
		{} as Record<string, ModelConfigItem>,
	);
}
