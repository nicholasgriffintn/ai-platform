import type { ModelConfig } from "~/types";

export const grokModelConfig: ModelConfig = {
  "grok-3": {
    name: "Grok 3",
    matchingModel: "grok-3-latest",
    description:
      "Excels at enterprise use cases like data extraction, coding, and text summarization. Possesses deep domain knowledge in finance, healthcare, law, and science.",
    provider: "grok",
    type: ["text"],
  },
  "grok-3-mini": {
    name: "Grok 3 Mini",
    matchingModel: "grok-3-mini-latest",
    description:
      "A lightweight model that thinks before responding. Fast, smart, and great for logic-based tasks that do not require deep domain knowledge. The raw thinking traces are accessible.",
    provider: "grok",
    type: ["text"],
  },
};
