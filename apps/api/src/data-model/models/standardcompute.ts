import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "standardcompute";

export const standardComputeModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("standardcompute", PROVIDER, {
    name: "Standard Compute",
    matchingModel: "standardcompute",
    modalities: { input: ["text"], output: ["text"] },
    supportsTemperature: true,
    supportsToolCalls: true,
  	family: "auto",
  	openWeights: false,
  	releaseDate: "March 1, 2026",
  	lastUpdated: "August 24, 2026",
  	supportsAttachments: true,
  	supportsResponseFormat: true,
  	contextWindow: 1000000,
  	maxTokens: 24576,
  	costPer1kInputTokens: 0,
  	costPer1kOutputTokens: 0,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),
]);
