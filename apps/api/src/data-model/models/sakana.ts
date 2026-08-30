import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "sakana";

export const sakanaModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("fugu", PROVIDER, {
    name: "Fugu",
    matchingModel: "fugu",
    modalities: { input: ["text"], output: ["text"] },
    supportsTemperature: false,
    supportsToolCalls: true,
  	family: "fugu",
  	openWeights: false,
  	releaseDate: "June 15, 2026",
  	lastUpdated: "June 15, 2026",
  	supportsAttachments: true,
  	supportsResponseFormat: true,
  	contextWindow: 1000000,
  	maxTokens: 1000000,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),
  createModelConfig("fugu-ultra", PROVIDER, {
    name: "Fugu Ultra",
    matchingModel: "fugu-ultra",
    modalities: { input: ["text"], output: ["text"] },
    supportsTemperature: false,
    supportsToolCalls: true,
  	family: "fugu",
  	openWeights: false,
  	releaseDate: "June 15, 2026",
  	lastUpdated: "June 15, 2026",
  	supportsAttachments: true,
  	supportsResponseFormat: true,
  	contextWindow: 1000000,
  	maxTokens: 1000000,
  	costPer1kInputTokens: 0.005,
  	costPer1kOutputTokens: 0.03,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),
  createModelConfig("sakana-namazu", PROVIDER, {
  	name: "Sakana Namazu",
  	matchingModel: "sakana-namazu",
  	family: "sakana-namazu",
  	openWeights: false,
  	releaseDate: "August 3, 2026",
  	lastUpdated: "August 3, 2026",
  	modalities: {
  		input: ["text", "image", "pdf"],
  		output: ["text"],
  	},
  	supportsAttachments: true,
  	supportsTemperature: true,
  	supportsToolCalls: true,
  	supportsResponseFormat: true,
  	contextWindow: 262144,
  	maxTokens: 65536,
  	costPer1kInputTokens: 0.00095,
  	costPer1kOutputTokens: 0.004,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),
]);
