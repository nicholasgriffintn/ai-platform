import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { createModelConfig, createModelConfigObject } from "~/lib/providers/models/utils";

const PROVIDER = "hetzner";

export const hetznerModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("Qwen/Qwen3.6-35B-A3B-FP8", PROVIDER, {
    name: "Qwen3.6 35B A3B FP8",
    matchingModel: "Qwen/Qwen3.6-35B-A3B-FP8",
    family: "qwen",
    status: "beta",
    openWeights: true,
    releaseDate: "April 17, 2026",
    lastUpdated: "April 17, 2026",
    modalities: {
      input: ["text", "image"],
      output: ["text"],
    },
    supportsAttachments: true,
    supportsTemperature: true,
    supportsToolCalls: true,
    supportsResponseFormat: true,
    contextWindow: 262144,
    maxTokens: 262144,
    costPer1kInputTokens: 0,
    costPer1kOutputTokens: 0,
    isFree: true,
    reasoningConfig: {
      supportedEffortLevels: ["none", "thinking"],
      defaultEffort: "none",
    },
  }),

  createModelConfig("Qwen3.8-27B", PROVIDER, {
    name: "Qwen3.8-27B",
    matchingModel: "Qwen3.8-27B",
    family: "qwen",
    status: "beta",
    openWeights: true,
    releaseDate: "August 14, 2026",
    lastUpdated: "August 14, 2026",
    modalities: {
      input: ["text", "image"],
      output: ["text"],
    },
    supportsAttachments: true,
    supportsTemperature: true,
    supportsToolCalls: true,
    supportsResponseFormat: true,
    contextWindow: 262144,
    maxTokens: 262144,
    costPer1kInputTokens: 0,
    costPer1kOutputTokens: 0,
    isFree: true,
    reasoningConfig: {
      supportedEffortLevels: ["none", "thinking"],
      defaultEffort: "none",
    },
  }),
]);
