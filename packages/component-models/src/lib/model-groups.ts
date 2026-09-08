import type { ModelCatalogItem } from "@ngriffin_uk/polychat-schemas";
import type { ModelProviderListEntry } from "@ngriffin_uk/polychat-utility-core";

export function limitModelGroups(
  groups: ModelProviderListEntry<ModelCatalogItem>[],
  limit: number,
) {
  let remaining = limit;
  const visible: ModelProviderListEntry<ModelCatalogItem>[] = [];

  for (const group of groups) {
    if (remaining <= 0) {
      break;
    }

    const models = group.models.slice(0, remaining);

    visible.push({ ...group, models });
    remaining -= models.length;
  }

  return visible;
}
