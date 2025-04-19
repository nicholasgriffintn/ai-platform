import type { ModelConfig } from "../../types";

export const hyperbolicModelConfig: ModelConfig = {
  "Hermes-3-Llama-3.1-70B": {
    name: "Hermes-3-Llama-3.1-70B",
    matchingModel: "NousResearch/Hermes-3-Llama-3.1-70B",
    description:
      "Hermes 3 is a generalist language model with many improvements over Hermes 2, including advanced agentic capabilities, much better roleplaying, reasoning, multi-turn conversation, long context coherence, and improvements across the board.",
    provider: "hyperbolic",
    type: ["text"],
    supportsFunctions: true,
    isFree: false,
    isFeatured: true,
    supportsResponseFormat: true,
    contextWindow: 24000,
    maxTokens: 1024,
    strengths: ["instruction", "coding", "reasoning", "chat"],
  },
};
