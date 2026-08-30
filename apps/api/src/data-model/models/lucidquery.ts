import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "lucidquery";

export const lucidQueryModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("lucidquery-agi-01-frontier", PROVIDER, {
    name: "LucidQuery AGI 01 Frontier",
    matchingModel: "lucidquery-agi-01-frontier",
    modalities: { input: ["text"], output: ["text"] },
    supportsTemperature: true,
    supportsToolCalls: true,
  	family: "agi",
  	openWeights: false,
  	knowledgeCutoffDate: "June 5, 2026",
  	releaseDate: "June 16, 2026",
  	lastUpdated: "June 16, 2026",
  	supportsAttachments: true,
  	contextWindow: 300000,
  	maxTokens: 120000,
  	costPer1kInputTokens: 0.0045,
  	costPer1kOutputTokens: 0.022,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),
  createModelConfig("lucidquery-nexus-coder", PROVIDER, {
    name: "LucidQuery Nexus Coder",
    matchingModel: "lucidquery-nexus-coder",
    modalities: { input: ["text"], output: ["text"] },
    supportsTemperature: false,
    supportsToolCalls: true,
  	family: "lucid",
  	openWeights: false,
  	knowledgeCutoffDate: "August 1, 2025",
  	releaseDate: "September 1, 2025",
  	lastUpdated: "September 1, 2025",
  	supportsAttachments: true,
  	contextWindow: 250000,
  	maxTokens: 60000,
  	costPer1kInputTokens: 0.002,
  	costPer1kOutputTokens: 0.005,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),
  createModelConfig("lucidnova-rf1-100b", PROVIDER, {
  	name: "LucidNova RF1 100B",
  	matchingModel: "lucidnova-rf1-100b",
  	family: "nova",
  	openWeights: false,
  	knowledgeCutoffDate: "September 16, 2025",
  	releaseDate: "December 28, 2024",
  	lastUpdated: "September 10, 2025",
  	modalities: {
  		input: ["text"],
  		output: ["text"],
  	},
  	supportsAttachments: true,
  	supportsTemperature: false,
  	supportsToolCalls: true,
  	contextWindow: 120000,
  	maxTokens: 8000,
  	costPer1kInputTokens: 0.002,
  	costPer1kOutputTokens: 0.005,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),

  createModelConfig("lucidquery-agi-01-swift", PROVIDER, {
  	name: "AGI-01 Swift",
  	matchingModel: "lucidquery-agi-01-swift",
  	family: "agi",
  	openWeights: false,
  	knowledgeCutoffDate: "June 5, 2026",
  	releaseDate: "June 16, 2026",
  	lastUpdated: "June 16, 2026",
  	modalities: {
  		input: ["text", "image"],
  		output: ["text"],
  	},
  	supportsAttachments: true,
  	supportsTemperature: true,
  	supportsToolCalls: true,
  	contextWindow: 300000,
  	maxTokens: 120000,
  	costPer1kInputTokens: 0.0025,
  	costPer1kOutputTokens: 0.015,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),
]);
