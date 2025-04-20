import type { ModelConfig } from "~/types";

export const grokModelConfig: ModelConfig = {
  "grok-beta": {
    name: "Grok Beta",
    matchingModel: "grok-beta-latest",
    description: "Grok's upcoming model.",
    provider: "grok",
    type: ["text"],
  },
  "grok-vision-beta": {
    name: "Grok Vision Beta",
    matchingModel: "grok-vision-beta-latest",
    description: "Grok's upcoming model.",
    provider: "grok",
    type: ["image-to-text"],
  },
  "grok-2": {
    name: "Grok 2",
    matchingModel: "grok-2-latest",
    description:
      "Grok's flagship LLM that delivers unfiltered insights and raw intelligence.",
    provider: "grok",
    type: ["text"],
  },
  "grok-2-vision": {
    name: "Grok 2 Vision",
    matchingModel: "grok-2-vision-latest",
    description:
      "Grok's image-understanding LLM that excels at processing diverse visual inputs like documents and photos.",
    provider: "grok",
    type: ["image-to-text"],
  },
};
