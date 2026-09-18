import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import catalogueData from "./data/index.js";
import {
  modelCatalogueSchema,
  resolveCatalogueProvider,
  resolveModelCatalogue,
  type ModelCatalogue,
} from "./schema.js";

export const modelCatalogue: ModelCatalogue = modelCatalogueSchema.parse(catalogueData);

const providerModels = new Map<string, ModelConfig>();
let resolvedCatalogue: ModelConfig | null = null;

export function getCatalogueModels(): ModelConfig {
  if (!resolvedCatalogue) {
    resolvedCatalogue = resolveModelCatalogue(modelCatalogue);
  }

  return resolvedCatalogue;
}

export function getCatalogueProviderModels(provider: string): ModelConfig {
  let config = providerModels.get(provider);

  if (!config) {
    config = resolveCatalogueProvider(modelCatalogue, provider);
    providerModels.set(provider, config);
  }

  return config;
}

export function listCatalogueProviders(): string[] {
  return Object.keys(modelCatalogue.providers);
}
