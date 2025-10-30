import type { ModelConfig } from "~/types";

export const parallelModelConfig: ModelConfig = {
  "parallel-speed": {
    name: "Parallel Speed",
    matchingModel: "speed",
    description:
      "Parallel's speed-optimized model for fast, comprehensive research and analysis tasks. Uses OpenAI-compatible chat completions by default.",
    provider: "parallel",
    type: ["text"],
    strengths: ["research", "search", "analysis"],
    isFeatured: false,
    includedInRouter: false,
    supportsArtifacts: false,
    isFree: false,
  },
};
