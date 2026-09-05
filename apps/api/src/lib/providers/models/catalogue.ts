import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import catalogueData from "~/data-model/models";

import {
  modelCatalogueSchema,
  resolveCatalogueProvider,
  resolveModelCatalogue,
} from "./catalogue-definition.mjs";

const catalogue = modelCatalogueSchema.parse(catalogueData);
const providerModels = new Map<string, ModelConfig>();

export const modelConfig = resolveModelCatalogue(catalogue);

export function getProviderModels(provider: string): ModelConfig {
  let config = providerModels.get(provider);

  if (!config) {
    config = resolveCatalogueProvider(catalogue, provider);
    providerModels.set(provider, config);
  }

  return config;
}
