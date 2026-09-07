import {
  collapseRegionalModelVariants as collapseRegionalModelVariantsCore,
  getRegionalModelGroupingDisplayName,
  getSelectedRegionalModelId as getSelectedRegionalModelIdCore,
  isRegionalModelEntrySelected as isRegionalModelEntrySelectedCore,
  type ModelRegionOption as CoreModelRegionOption,
  type RegionalModelListEntry as CoreRegionalModelListEntry,
} from "@ngriffin_uk/polychat-utility-core";

import type { ModelCatalogItem } from "./models.js";

type BedrockRegionCode = "default" | "global" | "us" | "eu" | "jp" | "au";

export type ModelRegionOption = CoreModelRegionOption<ModelCatalogItem, BedrockRegionCode>;

export type RegionalModelListEntry = CoreRegionalModelListEntry<
  ModelCatalogItem,
  BedrockRegionCode
>;

export function getRegionalModelDisplayName(model: ModelCatalogItem) {
  return getRegionalModelGroupingDisplayName(model);
}

export function collapseRegionalModelVariants(
  models: readonly ModelCatalogItem[],
): RegionalModelListEntry[] {
  return collapseRegionalModelVariantsCore(models);
}

export function getSelectedRegionalModelId(
  entry: RegionalModelListEntry,
  selectedId?: string | null,
) {
  return getSelectedRegionalModelIdCore(entry, selectedId);
}

export function isRegionalModelEntrySelected(
  entry: RegionalModelListEntry,
  selectedId?: string | null,
) {
  return isRegionalModelEntrySelectedCore(entry, selectedId);
}
