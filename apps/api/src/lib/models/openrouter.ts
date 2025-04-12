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
