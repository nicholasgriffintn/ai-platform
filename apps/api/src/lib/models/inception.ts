import type { ModelConfig } from "~/types";
import { createModelConfig, createModelConfigObject } from "./utils";

const PROVIDER = "inception";

export const inceptionModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("mercury-coder", PROVIDER, {
    name: "Mercury Coder",
    matchingModel: "mercury-coder",
    description:
      "Mercury Coder is a specialized model optimized for coding tasks with tool calling support and extensive context window.",
    type: ["text", "coding"],
    knowledgeCutoffDate: "October 2023",
    releaseDate: "February 26, 2025",
    lastUpdated: "July 31, 2025",
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    supportsAttachments: false,
    supportsTemperature: true,
    supportsReasoning: false,
    supportsToolCalls: true,
    contextWindow: 128000,
    maxTokens: 16384,
    costPer1kInputTokens: 0.00025,
    costPer1kOutputTokens: 0.001,
    strengths: ["coding", "analysis", "instruction", "tool_use"],
    contextComplexity: 4,
    reliability: 4,
    speed: 4,
    isFeatured: true,
    includedInRouter: true,
    supportsNextEdit: true,
    supportsApplyEdit: true,
    supportsFim: true,
    supportsArtifacts: true,
  }),

  createModelConfig("mercury", PROVIDER, {
    name: "Mercury",
    matchingModel: "mercury",
    description:
      "Mercury is a general-purpose model with strong capabilities in text generation, analysis, and tool calling.",
    type: ["text"],
    knowledgeCutoffDate: "October 2023",
    releaseDate: "June 26, 2025",
    lastUpdated: "July 31, 2025",
    modalities: {
      input: ["text"],
      output: ["text"],
    },
    supportsAttachments: false,
    supportsTemperature: true,
    supportsReasoning: false,
    supportsToolCalls: true,
    contextWindow: 128000,
    maxTokens: 16384,
    costPer1kInputTokens: 0.00025,
    costPer1kOutputTokens: 0.001,
    strengths: ["chat", "general_knowledge", "analysis", "tool_use"],
    contextComplexity: 4,
    reliability: 4,
    speed: 4,
    isFeatured: true,
    includedInRouter: true,
    supportsArtifacts: true,
  }),
]);
