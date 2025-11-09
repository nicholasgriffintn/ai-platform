import type { ModelConfig, ModelConfigItem } from "~/types";
import { availableCapabilities, availableModelTypes } from "~/constants/models";

export function createModelConfig(
	key: string,
	provider: string,
	config: Partial<ModelConfigItem>,
): [string, ModelConfigItem] {
	return [
		key,
		{
			matchingModel: config.matchingModel || key,
			name: config.name || key,
			provider,
			type: config.type || ["text"],
			...config,
		},
	];
}

export function createModelConfigObject(
	entries: Array<[string, ModelConfigItem]>,
): ModelConfig {
	return Object.fromEntries(entries);
}

export { availableCapabilities, availableModelTypes };
