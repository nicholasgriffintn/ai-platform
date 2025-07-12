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
  "moonshotai/kimi-k2": {
    name: "MoonshotAI: Kimi K2",
    matchingModel: "moonshotai/kimi-k2",
    description:
      "A large-scale Mixture-of-Experts (MoE) language model developed by Moonshot AI, designed for both complex reasoning and efficient dialogue.",
    provider: "openrouter",
    type: ["text"],
    costPer1kInputTokens: 0.00057,
    costPer1kOutputTokens: 0.0023,
    supportsFunctions: true,
    contextWindow: 131000,
  },
  "morph/morph-v3-large": {
    name: "Morph V3 Large",
    matchingModel: "morph/morph-v3-large",
    description:
      "Morph's high-accuracy apply model for complex code edits. 2000+ tokens/sec with 98% accuracy for precise code transformations.",
    provider: "openrouter",
    type: ["code-edits"],
    contextWindow: 32000,
    maxTokens: 16000,
    costPer1kInputTokens: 0.0012,
    costPer1kOutputTokens: 0.0027,
  },
  "morph/morph-v3-fast": {
    name: "Morph V3 Fast",
    matchingModel: "morph/morph-v3-fast",
    description:
      "Morph's fastest apply model for code edits. 4500+ tokens/sec with 96% accuracy for rapid code transformations.",
    provider: "openrouter",
    type: ["code-edits"],
    contextWindow: 32000,
    maxTokens: 16000,
    costPer1kInputTokens: 0.0012,
    costPer1kOutputTokens: 0.0027,
  },
  "morph/morph-v2": {
    name: "Morph V2",
    matchingModel: "morph/morph-v2",
    description:
      "Morph Apply is a specialized code-patching LLM that merges AI-suggested edits straight into your source files. It can apply updates from GPT-4o, Claude, and others into your files at 4000+ tokens per second.",
    provider: "openrouter",
    type: ["code-edits"],
    contextWindow: 32000,
    maxTokens: 16000,
    costPer1kInputTokens: 0.0012,
    costPer1kOutputTokens: 0.0027,
  },
  "arcee-ai/caller-large": {
    name: "Arcee AI: Caller Large",
    matchingModel: "arcee-ai/caller-large",
    description:
      "Caller Large is Arcee's specialist 'function‑calling' SLM built to orchestrate external tools and APIs. Instead of maximizing next‑token accuracy, training focuses on structured JSON outputs.",
    provider: "openrouter",
    type: ["function-calling"],
    contextWindow: 33000,
    maxTokens: 33000,
    costPer1kInputTokens: 0.00055,
    costPer1kOutputTokens: 0.00085,
    supportsFunctions: true,
  },
};
