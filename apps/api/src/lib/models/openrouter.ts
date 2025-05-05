import type { ModelConfig } from "~/types";

export const openrouterModelConfig: ModelConfig = {
  auto: {
    name: "OpenRouter Auto",
    description:
      "OpenRouter's auto model, will select the best model for the task.",
    matchingModel: "openrouter/auto",
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
  "qwen/qwen3-14b": {
    name: "Qwen 3 14B",
    matchingModel: "qwen/qwen3-14b",
    description:
      'Qwen3-14B is a dense 14.8B parameter causal language model from the Qwen3 series, designed for both complex reasoning and efficient dialogue. It supports seamless switching between a "thinking" mode for tasks like math, programming, and logical inference, and a "non-thinking" mode for general-purpose conversation',
    provider: "openrouter",
    type: ["text"],
    costPer1kInputTokens: 0.00007,
    costPer1kOutputTokens: 0.00024,
  },
  "qwen/qwen3-32b": {
    name: "Qwen 3 32B",
    matchingModel: "qwen/qwen3-32b",
    description:
      'Qwen3-32B is a dense 32B parameter causal language model from the Qwen3 series, designed for both complex reasoning and efficient dialogue. It supports seamless switching between a "thinking" mode for tasks like math, programming, and logical inference, and a "non-thinking" mode for general-purpose conversation',
    provider: "openrouter",
    type: ["text"],
    costPer1kInputTokens: 0.0001,
    costPer1kOutputTokens: 0.0003,
    isFree: true,
    isFeatured: true,
  },
  "qwen3-235b-a22b": {
    name: "Qwen 3 235B (A22B)",
    matchingModel: "qwen/qwen3-235b-a22b",
    description:
      'Qwen3-235B-A22B is a 235B parameter mixture-of-experts (MoE) model developed by Qwen, activating 22B parameters per forward pass. It supports seamless switching between a "thinking" mode for complex reasoning, math, and code tasks, and a "non-thinking" mode for general conversational efficiency.',
    provider: "openrouter",
    type: ["text"],
    costPer1kInputTokens: 0.0001,
    costPer1kOutputTokens: 0.0001,
  },
};
