import type { ModelConfig } from "../../types";

export const googleAiStudioModelConfig: ModelConfig = {
  "gemini-2.5-pro-exp": {
    name: "Gemini 2.5 Pro Experimental",
    matchingModel: "gemini-2.5-pro-exp-03-25",
    description:
      "Gemini 2.5 Pro Experimental is our state-of-the-art thinking model, capable of reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context.",
    provider: "google-ai-studio",
    type: ["text"],
    strengths: ["coding", "analysis", "math", "multilingual"],
    multimodal: false,
    supportsFunctions: false,
    supportsSearchGrounding: true,
    hasThinking: true,
    contextWindow: 1000000,
    supportsArtifacts: true,
    isFeatured: true,
  },
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    matchingModel: "gemini-2.0-flash",
    description:
      "Gemini 2.0 Flash delivers next-gen features and improved capabilities, including superior speed, native tool use, multimodal generation, and a 1M token context window.",
    provider: "google-ai-studio",
    type: ["text"],
    card: "https://www.prompthub.us/models/gemini-2-0-flash",
    contextWindow: 1048576,
    maxTokens: 8192,
    costPer1kInputTokens: 0,
    costPer1kOutputTokens: 0,
    strengths: ["coding", "analysis", "math", "multilingual"],
    contextComplexity: 4,
    reliability: 4,
    speed: 3,
    supportsFunctions: false,
    multimodal: false,
    isFeatured: true,
    includedInRouter: true,
    supportsArtifacts: true,
    supportsSearchGrounding: true,
  },
  "gemini-2.0-flash-lite": {
    name: "Gemini 2.0 Flash Lite",
    matchingModel: "gemini-2.0-flash-lite",
    description:
      "A Gemini 2.0 Flash model optimized for cost efficiency and low latency.",
    provider: "google-ai-studio",
    type: ["text"],
    strengths: ["coding", "analysis", "math", "multilingual"],
    contextWindow: 1000000,
    supportsArtifacts: true,
  },
};
