import type { ModelConfig } from "~/types";

export const v0ModelConfig: ModelConfig = {
  "v0-1.0": {
    name: "V0 1.0",
    description:
      "The v0 model is designed for building modern web applications with text and image outputs and optimisation for frontend and full stack web development.",
    matchingModel: "v0-1.0-md",
    provider: "v0",
    type: ["coding"],
    strengths: ["coding"],
    contextComplexity: 4,
    reliability: 4,
    speed: 4,
    contextWindow: 128000,
    maxTokens: 32000,
    isFeatured: true,
    includedInRouter: false,
    multimodal: true,
    costPer1kOutputTokens: 0.003,
    costPer1kInputTokens: 0.015,
  },
};
