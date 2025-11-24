import { prebuiltAppConfig } from "@mlc-ai/web-llm";

import type { ChatMode, ModelConfig, ModelConfigItem } from "~/types";

export const defaultModel = "mistral-medium";

const modelsFromWebLLM = prebuiltAppConfig?.model_list as {
	model: string;
	model_id: string;
}[];
const filteredModelsFromWebLLM = modelsFromWebLLM.filter((model) => {
	return model.model_id.includes("q0f16") || model.model_id.includes("q4f16");
});

export const webLLMModels: ModelConfig = {
	...filteredModelsFromWebLLM.reduce((acc, model) => {
		const newModel = {
			id: model.model_id,
			matchingModel: model.model_id,
			name: model.model_id,
			description: model.model,
			strengths: ["text-generation"],
			provider: "web-llm",
			modalities: { input: ["text" as const], output: ["text" as const] },
			isFree: true,
			isFeatured: true,
		};
		acc[model.model_id] = newModel;
		return acc;
	}, {} as ModelConfig),
};

export function getAvailableModels(
	apiModels: ModelConfig,
	shouldIncludeWebLLM = true,
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

export function getModelsByMode(models: ModelConfig, mode: ChatMode) {
	return Object.entries(models).reduce(
		(acc, [key, model]) => {
			const hasIncompatibleProvider = model.provider === "ollama";
			const inputs = model.modalities?.input ?? ["text"];
			const outputs = model.modalities?.output ?? inputs;
			const supportsText = outputs.includes("text");
			const isEmbeddingOnly =
				outputs.length > 0 &&
				outputs.every((modality) => modality === "embedding");
			const isAudioOnly =
				outputs.length > 0 && outputs.every((modality) => modality === "audio");
			const isVideoOnly =
				outputs.length > 0 && outputs.every((modality) => modality === "video");
			const isIncompatible =
				hasIncompatibleProvider ||
				(!supportsText && (isAudioOnly || isVideoOnly)) ||
				isEmbeddingOnly ||
				model.hiddenFromDefaultList;

			if (
				!isIncompatible &&
				(mode === "local"
					? model.provider === "web-llm"
					: model.provider !== "web-llm")
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
