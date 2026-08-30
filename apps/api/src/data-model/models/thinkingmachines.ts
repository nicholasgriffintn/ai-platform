import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "thinkingmachines";

export const thinkingMachinesModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("thinkingmachines/Inkling", PROVIDER, {
    name: "Inkling",
    matchingModel: "thinkingmachines/Inkling",
    modalities: { input: ["text"], output: ["text"] },
    supportsTemperature: true,
    supportsToolCalls: true,
  	family: "ling",
  	openWeights: true,
  	releaseDate: "July 15, 2026",
  	lastUpdated: "July 15, 2026",
  	supportsAttachments: true,
  	contextWindow: 65536,
  	maxTokens: 65536,
  	costPer1kInputTokens: 0.00187,
  	costPer1kOutputTokens: 0.00468,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),
  createModelConfig("thinkingmachines/Inkling:peft:262144", PROVIDER, {
  	name: "Inkling (256K)",
  	matchingModel: "thinkingmachines/Inkling:peft:262144",
  	family: "ling",
  	openWeights: true,
  	releaseDate: "July 15, 2026",
  	lastUpdated: "July 15, 2026",
  	modalities: {
  		input: ["text", "image"],
  		output: ["text"],
  	},
  	supportsAttachments: true,
  	supportsTemperature: true,
  	supportsToolCalls: true,
  	contextWindow: 262144,
  	maxTokens: 262144,
  	costPer1kInputTokens: 0.00374,
  	costPer1kOutputTokens: 0.00936,
  	reasoningConfig: {
  		supportedEffortLevels: ["none", "thinking"],
  		defaultEffort: "none",
  	},
  }),
]);
