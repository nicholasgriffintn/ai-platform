import type { ModelConfig } from "../../types";

export const openrouterModelConfig: ModelConfig = {
  auto: {
    name: "OpenRouter Auto",
    description:
      "OpenRouter's auto model, will select the best model for the task.",
    matchingModel: "openrouter/auto",
    provider: "openrouter",
    type: ["text"],
  },
  "gemini-2.0-flash": {
    name: "Google Gemini 2.0 Flash",
    matchingModel: "google/gemini-2.0-flash-001",
    description:
      "Latest Gemini model optimized for coding, analysis, math, and multilingual tasks with exceptional speed.",
    provider: "openrouter",
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
    supportsFunctions: true,
    multimodal: true,
    isFeatured: true,
    includedInRouter: true,
    supportsArtifacts: true,
  },
  "gemini-1.5-flash": {
    name: "Google Gemini 1.5 Flash",
    matchingModel: "google/gemini-flash-1.5",
    provider: "openrouter",
    type: ["text"],
  },
  "gemini-1.5-pro": {
    name: "Google Gemini 1.5 Pro",
    matchingModel: "google/gemini-pro-1.5",
    provider: "openrouter",
    type: ["text"],
  },
  "gemini-1.5-flash-8b": {
    name: "Google Gemini 1.5 Flash 8B",
    matchingModel: "google/gemini-flash-1.5-8b",
    provider: "openrouter",
    type: ["text"],
  },
  "gemini-2-0-pro": {
    name: "Google Gemini 2.0 Pro (beta)",
    matchingModel: "google/gemini-2.0-pro-exp-02-05:free",
    provider: "openrouter",
    type: ["text"],
    isBeta: true,
    card: "https://www.prompthub.us/models/gemini-2-0-pro",
  },
  "qwq-32b": {
    name: "QwQ 32B",
    matchingModel: "qwen/qwq-32b-preview",
    description:
      "QwQ is an experimental research model focused on advancing AI reasoning capabilities.",
    provider: "openrouter",
    type: ["text"],
  },
  "mythomax-l2-13b": {
    name: "Mythomax L2 13B",
    matchingModel: "gryphe/mythomax-l2-13b",
    description:
      "Advanced language model with strong text generation capabilities.",
    provider: "openrouter",
    type: ["text"],
  },
  "deepseek-v3": {
    name: "DeepSeek V3",
    matchingModel: "deepseek/deepseek-chat-v3-0324:free",
    description:
      "DeepSeek V3, a 685B-parameter, mixture-of-experts model, is the latest iteration of the flagship chat model family from the DeepSeek team.",
    provider: "openrouter",
    type: ["text"],
    isFree: true,
  },
};
