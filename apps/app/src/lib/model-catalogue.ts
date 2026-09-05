import { getModelDisplayName, type ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export interface ModelProviderGroup {
  provider: string;
  label: string;
  models: ModelConfigItem[];
}

export function isCatalogueModel(model: ModelConfigItem): boolean {
  return !model.deprecated && model.status !== "deprecated" && !model.hiddenFromDefaultList;
}

export function formatProviderLabel(provider: string): string {
  return provider
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function compareModels(a: ModelConfigItem, b: ModelConfigItem): number {
  if (Boolean(a.isFeatured) !== Boolean(b.isFeatured)) {
    return a.isFeatured ? -1 : 1;
  }

  return getModelDisplayName(a).localeCompare(getModelDisplayName(b));
}

export function groupModelsByProvider(models: ModelConfigItem[]): ModelProviderGroup[] {
  const groups = new Map<string, ModelConfigItem[]>();

  for (const model of models) {
    const group = groups.get(model.provider) ?? [];

    group.push(model);
    groups.set(model.provider, group);
  }

  return [...groups.entries()]
    .map(([provider, providerModels]) => ({
      provider,
      label: formatProviderLabel(provider),
      models: [...providerModels].sort(compareModels),
    }))
    .sort((a, b) => b.models.length - a.models.length || a.label.localeCompare(b.label));
}
