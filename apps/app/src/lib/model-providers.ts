import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export interface ModelProviderSummary {
  id: string;
  modelCount: number;
}

export function summariseModelProviders(models: ModelConfigItem[]): ModelProviderSummary[] {
  const counts = new Map<string, number>();

  for (const model of models) {
    counts.set(model.provider, (counts.get(model.provider) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([id, modelCount]) => ({ id, modelCount }))
    .sort((a, b) => b.modelCount - a.modelCount || a.id.localeCompare(b.id));
}
