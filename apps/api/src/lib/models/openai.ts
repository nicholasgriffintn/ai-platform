import type { ModelConfig } from "../../types";
import { createModelConfig, createModelConfigObject } from "./utils";

const PROVIDER = "openai";

export const openaiModelConfig: ModelConfig = createModelConfigObject([
  createModelConfig("o1", PROVIDER, {
    name: "OpenAI o1",
    matchingModel: "o1",
    description:
      "Advanced model with strong capabilities in coding, analysis, math, reasoning, and multilingual support. Predecessor to o3, features 200k context window. Surpassed by o3 in complex reasoning and tool use.",
    type: ["text"],
    supportsFunctions: true,
    card: "https://www.prompthub.us/models/o1",
    contextWindow: 200000,
    maxTokens: 100000,
    costPer1kInputTokens: 0.015,
    costPer1kOutputTokens: 0.06,
    strengths: ["coding", "analysis", "math", "reasoning", "multilingual"],
    contextComplexity: 4,
    reliability: 4,
    speed: 1,
    multimodal: true,
    isFeatured: false,
    includedInRouter: true,
    hasThinking: true,
    supportsResponseFormat: true,
    supportsArtifacts: true,
  }),

  createModelConfig("o3", PROVIDER, {
    name: "OpenAI o3",
    matchingModel: "o3",
    description:
      "OpenAI's most powerful reasoning model, pushing frontiers in coding, math, science, visual perception. Agentically uses tools (web search, Python, visual analysis, image generation).",
    type: ["text"],
    supportsFunctions: true,
    contextWindow: 200000,
    maxTokens: 100000,
    costPer1kInputTokens: 0.0011,
    costPer1kOutputTokens: 0.0044,
    strengths: ["coding", "math", "reasoning", "analysis", "multilingual"],
    contextComplexity: 5,
    reliability: 5,
    speed: 3,
    multimodal: true,
    isFeatured: true,
    includedInRouter: true,
    hasThinking: true,
    supportsResponseFormat: true,
    supportsArtifacts: true,
  }),

  createModelConfig("o4-mini", PROVIDER, {
    name: "OpenAI o4 Mini",
    matchingModel: "o4-mini",
    description:
      "Smaller model optimized for fast, cost-efficient reasoning. Strong performance in math, coding, visual tasks, and data science. Agentically uses tools.",
    type: ["text"],
    supportsFunctions: true,
    contextWindow: 200000,
    maxTokens: 100000,
    costPer1kInputTokens: 0.0011,
    costPer1kOutputTokens: 0.0044,
    strengths: ["math", "coding", "reasoning", "analysis", "chat"],
    contextComplexity: 4,
    reliability: 4,
    speed: 4,
    multimodal: true,
    isFeatured: true,
    includedInRouter: true,
    hasThinking: true,
    supportsResponseFormat: true,
    supportsArtifacts: true,
  }),

  createModelConfig("o3-mini", PROVIDER, {
    name: "OpenAI o3 Mini",
    matchingModel: "o3-mini",
    description:
      "Fast, flexible reasoning model, predecessor to o4-mini. Good reasoning capabilities.",
    type: ["text"],
    card: "https://www.prompthub.us/models/o3-mini",
    contextWindow: 200000,
    maxTokens: 100000,
    costPer1kInputTokens: 0.0011,
    costPer1kOutputTokens: 0.0044,
    strengths: ["coding", "analysis", "math", "reasoning", "multilingual"],
    contextComplexity: 3,
    reliability: 3,
    speed: 3,
    multimodal: false,
    isFeatured: false,
    includedInRouter: false,
    hasThinking: true,
    supportsResponseFormat: true,
    supportsArtifacts: true,
  }),

  createModelConfig("gpt-4o", PROVIDER, {
    name: "OpenAI GPT-4o",
    matchingModel: "gpt-4o",
    description:
      "Enhanced GPT model with 128k context window, specialized in analysis, chat, coding, and multilingual tasks.",
    type: ["text"],
    supportsFunctions: true,
    card: "https://www.prompthub.us/models/gpt-4o",
    contextWindow: 128000,
    maxTokens: 16484,
    costPer1kInputTokens: 0.0025,
    costPer1kOutputTokens: 0.01,
    strengths: ["analysis", "chat", "coding", "multilingual"],
    contextComplexity: 4,
    reliability: 4,
    speed: 4,
    multimodal: true,
    isFeatured: true,
    includedInRouter: true,
    supportsResponseFormat: true,
    supportsArtifacts: true,
  }),

  createModelConfig("gpt-4o-mini", PROVIDER, {
    name: "OpenAI GPT-4o Mini",
    matchingModel: "gpt-4o-mini",
    description:
      "Efficient version of GPT-4o optimized for faster response times while maintaining core capabilities.",
    type: ["text"],
    supportsFunctions: true,
    card: "https://www.prompthub.us/models/gpt-4o-mini",
    contextWindow: 128000,
    maxTokens: 16484,
    costPer1kInputTokens: 0.00015,
    costPer1kOutputTokens: 0.0006,
    strengths: ["analysis", "chat", "coding", "multilingual"],
    contextComplexity: 3,
    reliability: 3,
    speed: 5,
    isFeatured: true,
    includedInRouter: true,
    supportsResponseFormat: true,
    supportsArtifacts: true,
  }),

  createModelConfig("gpt-4.5", PROVIDER, {
    name: "OpenAI GPT-4.5",
    matchingModel: "gpt-4.5-preview",
    description:
      "GPT-4.5 excels at tasks that benefit from creative, open-ended thinking and conversation, such as writing, learning, or exploring new ideas.",
    type: ["text"],
    supportsFunctions: true,
    card: "https://platform.openai.com/docs/models/gpt-4.5-preview",
    contextWindow: 128000,
    maxTokens: 4096,
    costPer1kInputTokens: 0.01,
    costPer1kOutputTokens: 0.03,
    strengths: ["coding", "analysis", "reasoning", "multilingual"],
    contextComplexity: 5,
    reliability: 5,
    speed: 4,
    multimodal: true,
    isFeatured: false,
    includedInRouter: true,
    supportsResponseFormat: true,
    supportsArtifacts: true,
  }),

  createModelConfig("gpt-4.1", PROVIDER, {
    name: "OpenAI GPT-4.1",
    matchingModel: "gpt-4.1",
    description:
      "OpenAI's advanced model optimized for coding and instruction-following with 1M token context window",
    type: ["coding"],
    card: "https://www.prompthub.us/models/gpt-4-1",
    supportsFunctions: true,
    maxTokens: 1000000,
    contextWindow: 1000000,
    costPer1kInputTokens: 0.002,
    costPer1kOutputTokens: 0.008,
    strengths: ["coding", "academic", "reasoning", "instruction", "vision"],
    contextComplexity: 5,
    reliability: 5,
    speed: 3,
    multimodal: true,
    supportsArtifacts: true,
    isFeatured: true,
    includedInRouter: true,
  }),
  createModelConfig("gpt-4.1-mini", PROVIDER, {
    name: "OpenAI GPT-4.1 Mini",
    matchingModel: "gpt-4.1-mini",
    description:
      "Balanced version of GPT-4.1 with 1M token context window and lower cost",
    type: ["coding"],
    card: "https://www.prompthub.us/models/gpt-4-1-mini",
    supportsFunctions: true,
    maxTokens: 1000000,
    contextWindow: 1000000,
    costPer1kInputTokens: 0.0004,
    costPer1kOutputTokens: 0.0016,
    strengths: ["coding", "academic", "instruction", "vision"],
    contextComplexity: 4,
    reliability: 4,
    speed: 4,
    multimodal: true,
    supportsArtifacts: true,
    isFeatured: true,
    includedInRouter: true,
  }),
  createModelConfig("gpt-4.1-nano", PROVIDER, {
    name: "OpenAI GPT-4.1 Nano",
    matchingModel: "gpt-4.1-nano",
    description:
      "Fastest and most cost-effective version of GPT-4.1 with 1M token context window",
    type: ["coding"],
    card: "https://www.prompthub.us/models/gpt-4-1-nano",
    supportsFunctions: true,
    maxTokens: 1000000,
    contextWindow: 1000000,
    costPer1kInputTokens: 0.0001,
    costPer1kOutputTokens: 0.0004,
    strengths: ["coding", "academic", "instruction"],
    contextComplexity: 3,
    reliability: 3,
    speed: 5,
    multimodal: true,
    supportsArtifacts: true,
    isFeatured: false,
    includedInRouter: true,
  }),
]);
