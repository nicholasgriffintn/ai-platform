import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "./utils";

const PROVIDER = "morph";

export const morphModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("morph-auto", PROVIDER, {
    name: "Auto",
    matchingModel: "auto",
    description:
      "Morph's automatic model selection that routes to the best model for the task.",
    type: ["coding"],
    knowledgeCutoffDate: "June 2024",
    releaseDate: "June 1, 2024",
    lastUpdated: "June 1, 2024",
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    supportsAttachments: false,
    supportsTemperature: false,
    supportsReasoning: false,
    supportsToolCalls: false,
    contextWindow: 32000,
    maxTokens: 32000,
    costPer1kInputTokens: 0.00085,
    costPer1kOutputTokens: 0.00155,
    strengths: ["chat", "general_knowledge", "analysis"],
    contextComplexity: 3,
    reliability: 3,
    speed: 4,
    includedInRouter: true,
    supportsArtifacts: true,
  }),

  createModelConfig("morph-v3-large", PROVIDER, {
    name: "Morph v3 Large",
    matchingModel: "morph-v3-large",
    description:
      "Morph's large v3 model with enhanced capabilities for complex tasks and analysis.",
    type: ["coding"],
    knowledgeCutoffDate: "August 2024",
    releaseDate: "August 15, 2024",
    lastUpdated: "August 15, 2024",
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    supportsAttachments: false,
    supportsTemperature: false,
    supportsReasoning: false,
    supportsToolCalls: false,
    contextWindow: 32000,
    maxTokens: 32000,
    costPer1kInputTokens: 0.0009,
    costPer1kOutputTokens: 0.0019,
    strengths: ["chat", "general_knowledge", "analysis", "reasoning"],
    contextComplexity: 4,
    reliability: 4,
    speed: 3,
    includedInRouter: true,
    supportsArtifacts: true,
  }),

  createModelConfig("morph-v3-fast", PROVIDER, {
    name: "Morph v3 Fast",
    matchingModel: "morph-v3-fast",
    description:
      "Morph's fast v3 model optimized for quick responses while maintaining quality.",
    type: ["coding"],
    knowledgeCutoffDate: "August 2024",
    releaseDate: "August 15, 2024",
    lastUpdated: "August 15, 2024",
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    supportsAttachments: false,
    supportsTemperature: false,
    supportsReasoning: false,
    supportsToolCalls: false,
    contextWindow: 16000,
    maxTokens: 16000,
    costPer1kInputTokens: 0.0008,
    costPer1kOutputTokens: 0.0012,
    strengths: ["chat", "general_knowledge", "analysis"],
    contextComplexity: 3,
    reliability: 3,
    speed: 5,
    includedInRouter: true,
    supportsArtifacts: true,
  }),
]);
