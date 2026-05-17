import type { ModelRecord } from "@mlc-ai/web-llm";

import type { ModelConfig } from "~/types";

let cachedWebLLMModels: ModelConfig | null = null;
let pendingWebLLMModels: Promise<ModelConfig> | null = null;

function buildWebLLMModels(models: ModelRecord[]): ModelConfig {
	return models
		.filter((model) => {
			return model.model_id.includes("q0f16") || model.model_id.includes("q4f16");
		})
		.reduce((acc, model) => {
			acc[model.model_id] = {
				id: model.model_id,
				matchingModel: model.model_id,
				name: model.model_id,
				description: model.model,
				strengths: ["text-generation"],
				provider: "web-llm",
				modalities: { input: ["text"], output: ["text"] },
				isFree: true,
				isFeatured: true,
			};
			return acc;
		}, {} as ModelConfig);
}

export function getCachedWebLLMModels() {
	return cachedWebLLMModels ?? {};
}

export async function loadWebLLMModels() {
	if (typeof window === "undefined") {
		return {};
	}

	if (cachedWebLLMModels) {
		return cachedWebLLMModels;
	}

	pendingWebLLMModels ??= import("@mlc-ai/web-llm")
		.then(({ prebuiltAppConfig }) => {
			cachedWebLLMModels = buildWebLLMModels(prebuiltAppConfig.model_list);
			return cachedWebLLMModels;
		})
		.catch((error: unknown) => {
			pendingWebLLMModels = null;
			throw error;
		});

	return pendingWebLLMModels;
}
