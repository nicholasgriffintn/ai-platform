import type { ModelConfig } from "../../types";
import {
	type availableCapabilities,
	type availableModelTypes,
	defaultModel,
} from "./constants";

import { anthropicModelConfig } from "./anthropic";
import { bedrockModelConfig } from "./bedrock";
import { deepseekModelConfig } from "./deepseek";
import { githubModelsConfig } from "./githubmodels";
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
	return modelConfig;
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
