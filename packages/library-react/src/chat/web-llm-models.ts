import { browserModelCatalogue } from "../lib/web-llm-catalogue.js";

export function getCachedWebLLMModels() {
  return browserModelCatalogue;
}

export async function loadWebLLMModels() {
  return browserModelCatalogue;
}

export function getWebLLMModelDisplayName(modelId: string): string {
  return browserModelCatalogue[modelId]?.name ?? modelId;
}
