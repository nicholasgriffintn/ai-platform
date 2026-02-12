import type { ModelConfig } from "~/types";
import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "cerebras";

export const cerebrasModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("cerebras/llama3.1-8b", PROVIDER, {
		name: "Llama 3.1 8B",
		matchingModel: "llama3.1-8b",
		description:
			"A high speed deployment of Llama 3.1 8B optimized for chat and reasoning tasks.",
		modalities: { input: ["text"], output: ["text"] },
		knowledgeCutoffDate: "December 2023",
		releaseDate: "January 1, 2025",
		lastUpdated: "January 1, 2025",
		supportsAttachments: false,
		supportsTemperature: true,
		supportsToolCalls: true,
		contextWindow: 32000,
		maxTokens: 8000,
		costPer1kInputTokens: 0.0001,
		costPer1kOutputTokens: 0.0001,
		reasoningConfig: {
			enabled: false,
		},
	}),
	createModelConfig("cerebras/llama-3.3-70b", PROVIDER, {
		name: "Cerebras Llama 3.3 70B",
		matchingModel: "llama-3.3-70b",
		description:
			"A high speed deployment of Llama 3.3. 70b optimized for chat and reasoning tasks.",
		modalities: { input: ["text"], output: ["text"] },
	}),
	createModelConfig("cerebras/gpt-oss-120b", PROVIDER, {
		name: "GPT OSS 120B",
		matchingModel: "gpt-oss-120b",
		description: "",
		modalities: { input: ["text"], output: ["text"] },
		releaseDate: "August 5, 2025",
		lastUpdated: "August 5, 2025",
		supportsAttachments: false,
		supportsTemperature: true,
		supportsToolCalls: true,
		contextWindow: 131072,
		maxTokens: 32768,
		costPer1kInputTokens: 0.00025,
		costPer1kOutputTokens: 0.00069,
		reasoningConfig: {
			enabled: true,
		},
	}),
	createModelConfig("cerebras/qwen-3-32b", PROVIDER, {
		name: "Cerebras Qwen 3 32B",
		matchingModel: "qwen-3-32b",
		description: "",
		modalities: { input: ["text"], output: ["text"] },
	}),
	createModelConfig("cerebras/zai-glm-4.6", PROVIDER, {
		name: "Cerebras ZAI GLM 4.6",
		matchingModel: "zai-glm-4.6",
		description:
			"This model delivers strong coding performance with advanced reasoning capabilities, superior tool use, and enhanced real-world performance in agentic coding applications.",
		modalities: { input: ["text"], output: ["text"] },
	}),
	createModelConfig("cerebras/zai-glm-4.7", PROVIDER, {
		name: "Z.AI GLM-4.7",
		matchingModel: "zai-glm-4.7",
		description:
			"This model delivers strong coding performance with advanced reasoning capabilities, superior tool use, and enhanced real-world performance in agentic coding applications.",
		modalities: { input: ["text"], output: ["text"] },
		releaseDate: "January 10, 2026",
		lastUpdated: "January 10, 2026",
		supportsAttachments: false,
		supportsTemperature: true,
		supportsToolCalls: true,
		contextWindow: 131072,
		maxTokens: 40000,
		costPer1kInputTokens: 0,
		costPer1kOutputTokens: 0,
		reasoningConfig: {
			enabled: false,
		},
	}),
	createModelConfig("cerebras/qwen-3-235b-a22b-instruct-2507", PROVIDER, {
		name: "Qwen 3 235B Instruct",
		matchingModel: "qwen-3-235b-a22b-instruct-2507",
		knowledgeCutoffDate: "April 2025",
		releaseDate: "July 22, 2025",
		lastUpdated: "July 22, 2025",
		modalities: {
			input: ["text"],
			output: ["text"],
		},
		supportsAttachments: false,
		supportsTemperature: true,
		supportsToolCalls: true,
		contextWindow: 131000,
		maxTokens: 32000,
		costPer1kInputTokens: 0.0006,
		costPer1kOutputTokens: 0.0012,
		reasoningConfig: {
			enabled: false,
		},
	}),
]);
