import type { ChatMode, ModelConfig, ModelConfigItem } from "~/types";

export const defaultModel = "deepseek-chat";

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

export function getModelsByMode(models: ModelConfig, mode: ChatMode) {
	return Object.entries(models).reduce(
		(acc, [key, model]) => {
			const hasIncompatibleProvider = model.provider === "ollama";
			const inputs = model.modalities?.input ?? ["text"];
			const outputs = model.modalities?.output ?? inputs;
			const supportsText = outputs.includes("text");
			const isEmbeddingOnly =
				outputs.length > 0 && outputs.every((modality) => modality === "embedding");
			const isAudioOnly = outputs.length > 0 && outputs.every((modality) => modality === "audio");
			const isVideoOnly = outputs.length > 0 && outputs.every((modality) => modality === "video");
			const isIncompatible =
				hasIncompatibleProvider ||
				(!supportsText && (isAudioOnly || isVideoOnly)) ||
				isEmbeddingOnly ||
				model.hiddenFromDefaultList;

			if (
				!isIncompatible &&
				(mode === "local" ? model.provider === "web-llm" : model.provider !== "web-llm")
			) {
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
