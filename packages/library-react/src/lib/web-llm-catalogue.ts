import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import catalogue from "./web-llm-catalogue.json";

export const browserModelCatalogue: ModelConfig = Object.fromEntries(
  catalogue.models.map((model) => [
    model.id,
    {
      id: model.id,
      matchingModel: model.id,
      name: model.id,
      description: model.url,
      strengths: ["chat"],
      provider: "web-llm",
      modalities: { input: ["text"], output: ["text"] },
      isFree: true,
      isFeatured: true,
    },
  ]),
);
