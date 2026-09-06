import { MODEL_ICONS, PROVIDER_ICONS } from "./iconDefinitions";
import { ICON_LOADERS } from "./iconLoaders";

export function resolveProviderIconName(provider: string): string | undefined {
  const normalizedProvider = provider.toLowerCase();
  const mapped = PROVIDER_ICONS[normalizedProvider];

  if (mapped && ICON_LOADERS[mapped]) {
    return mapped;
  }

  return ICON_LOADERS[normalizedProvider] ? normalizedProvider : undefined;
}

export function resolveModelIconName(modelName: string): string | undefined {
  const normalizedModelName = modelName.toLowerCase();

  for (const [pattern, icon] of Object.entries(MODEL_ICONS)) {
    if (normalizedModelName.includes(pattern)) {
      return icon;
    }
  }

  return undefined;
}
