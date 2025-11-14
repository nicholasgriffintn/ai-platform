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

export function createModelConfigObject(
	entries: Array<[string, ModelConfigItem]>,
): ModelConfig {
	return Object.fromEntries(entries);
}

export { availableModalities };
