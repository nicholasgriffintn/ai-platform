import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "poolside";

export const poolsideModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("poolside/laguna-m.1", PROVIDER, {
    name: "Laguna M.1",
    matchingModel: "poolside/laguna-m.1",
    family: "laguna",
    openWeights: true,
    releaseDate: "April 28, 2026",
    lastUpdated: "June 13, 2026",
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    supportsAttachments: false,
    supportsTemperature: true,
    supportsToolCalls: true,
    supportsResponseFormat: false,
    contextWindow: 262144,
    maxTokens: 32768,
    costPer1kInputTokens: 0,
    costPer1kOutputTokens: 0,
    reasoningConfig: {
      supportedEffortLevels: ["none", "thinking"],
      defaultEffort: "none",
    },
  }),

  createModelConfig("poolside/laguna-s-2.1", PROVIDER, {
    name: "Laguna S 2.1",
    matchingModel: "poolside/laguna-s-2.1",
    family: "laguna",
    openWeights: true,
    releaseDate: "July 21, 2026",
    lastUpdated: "July 21, 2026",
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    supportsAttachments: false,
    supportsTemperature: true,
    supportsToolCalls: true,
    supportsResponseFormat: false,
    contextWindow: 1048576,
    maxTokens: 32768,
    costPer1kInputTokens: 0,
    costPer1kOutputTokens: 0,
    reasoningConfig: {
      supportedEffortLevels: ["none", "thinking"],
      defaultEffort: "none",
    },
  }),

  createModelConfig("poolside/laguna-xs-2.1", PROVIDER, {
    name: "Laguna XS 2.1",
    matchingModel: "poolside/laguna-xs-2.1",
    family: "laguna",
    openWeights: true,
    releaseDate: "July 2, 2026",
    lastUpdated: "July 2, 2026",
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    supportsAttachments: false,
    supportsTemperature: true,
    supportsToolCalls: true,
    supportsResponseFormat: false,
    contextWindow: 262144,
    maxTokens: 32768,
    costPer1kInputTokens: 0,
    costPer1kOutputTokens: 0,
    reasoningConfig: {
      supportedEffortLevels: ["none", "thinking"],
      defaultEffort: "none",
    },
  }),
]);
