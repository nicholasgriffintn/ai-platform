import type { ModelConfig, ModelConfigItem, ModelModalities } from "~/types";
import { availableModalities } from "~/constants/models";

const DEFAULT_MODALITIES: ModelModalities = {
	input: ["text"],
	output: ["text"],
};

type ModelConfigInput = Omit<ModelConfigItem, "provider" | "modalities"> & {
	modalities?: ModelModalities;
};

function resolveModalities(modalities?: ModelModalities): ModelModalities {
	return modalities ?? DEFAULT_MODALITIES;
}

export function createModelConfig(
	key: string,
	provider: string,
	config: ModelConfigInput,
): [string, ModelConfigItem] {
	const { modalities, ...rest } = config;
	const resolvedModalities = resolveModalities(modalities);

	return [
		key,
		{
			matchingModel: rest.matchingModel || key,
			name: rest.name || key,
			provider,
			...rest,
			modalities: resolvedModalities,
		},
	];
}

export function createModelConfigObject(entries: Array<[string, ModelConfigItem]>): ModelConfig {
	return Object.fromEntries(entries);
}

function getUniqueModelId(models: ModelConfig, modelId: string, model: ModelConfigItem): string {
	if (!Object.prototype.hasOwnProperty.call(models, modelId)) {
		return modelId;
	}

	const providerModelId = `${model.provider}/${modelId}`;
	if (!Object.prototype.hasOwnProperty.call(models, providerModelId)) {
		return providerModelId;
	}

	let suffix = 2;
	let uniqueModelId = `${providerModelId}-${suffix}`;
	while (Object.prototype.hasOwnProperty.call(models, uniqueModelId)) {
		suffix += 1;
		uniqueModelId = `${providerModelId}-${suffix}`;
	}

	return uniqueModelId;
}

export function mergeModelConfigs(...configs: ModelConfig[]): ModelConfig {
	return configs.reduce((models, config) => {
		for (const [modelId, model] of Object.entries(config)) {
			models[getUniqueModelId(models, modelId, model)] = model;
		}
		return models;
	}, {} as ModelConfig);
}

export { availableModalities };
