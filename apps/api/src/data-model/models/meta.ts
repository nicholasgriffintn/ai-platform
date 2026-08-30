import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import {
	createModelConfig,
	createModelConfigObject,
} from "~/lib/providers/models/utils";

const PROVIDER = "meta";

export const metaModelConfig: ModelConfig = createModelConfigObject([
	createModelConfig("muse-spark-1.2", PROVIDER, {
		name: "Muse Spark 1.2",
		matchingModel: "muse-spark-1.2",
		family: "muse",
		modalities: { input: ["text"], output: ["text"] },
		supportsTemperature: true,
		supportsToolCalls: true,
		supportsResponseFormat: true,
		strengths: ["reasoning", "coding", "analysis", "tool_use"],
		reasoningConfig: {
			supportedEffortLevels: ["none", "thinking"],
			defaultEffort: "none",
		},
		openWeights: false,
		releaseDate: "August 5, 2026",
		lastUpdated: "August 5, 2026",
		supportsAttachments: true,
		contextWindow: 1048576,
		maxTokens: 131072,
		costPer1kInputTokens: 0.00125,
		costPer1kOutputTokens: 0.00425,
	}),
	createModelConfig("muse-spark-1.1", PROVIDER, {
		name: "Muse Spark 1.1",
		matchingModel: "muse-spark-1.1",
		family: "muse",
		modalities: { input: ["text"], output: ["text"] },
		supportsTemperature: true,
		supportsToolCalls: true,
		supportsResponseFormat: true,
		strengths: ["reasoning", "coding", "analysis", "tool_use"],
		reasoningConfig: {
			supportedEffortLevels: ["none", "thinking"],
			defaultEffort: "none",
		},
		openWeights: false,
		releaseDate: "April 8, 2026",
		lastUpdated: "July 9, 2026",
		supportsAttachments: true,
		contextWindow: 1000000,
		maxTokens: 32000,
		costPer1kInputTokens: 0.00125,
		costPer1kOutputTokens: 0.00425,
	}),
	createModelConfig("muse-spark-1.2-contributor", PROVIDER, {
		name: "Muse Spark 1.2 Contributor",
		matchingModel: "muse-spark-1.2-contributor",
		family: "muse",
		openWeights: false,
		releaseDate: "August 5, 2026",
		lastUpdated: "August 5, 2026",
		modalities: {
			input: ["text", "image", "video", "pdf", "audio"],
			output: ["text"],
		},
		supportsAttachments: true,
		supportsTemperature: true,
		supportsToolCalls: true,
		supportsResponseFormat: true,
		contextWindow: 1048576,
		maxTokens: 131072,
		costPer1kInputTokens: 0.0001,
		costPer1kOutputTokens: 0.0002,
		reasoningConfig: {
			supportedEffortLevels: ["none", "thinking"],
			defaultEffort: "none",
		},
	}),
]);
