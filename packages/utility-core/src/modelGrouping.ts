import { titleCaseSlug } from "./strings.js";

export interface ModelGroupingItem {
  id: string;
  matchingModel: string;
  name?: string;
  provider: string;
  kind?: "model" | "agent";
  deprecated?: boolean;
}

export const FEATURED_MODEL_GROUP_KEY = "featured";
export const AGENT_MODEL_GROUP_KEY = "agents";

const BEDROCK_PROVIDER = "bedrock";
const BEDROCK_REGION_LABELS = {
  default: "Default",
  global: "Global",
  us: "US",
  eu: "EU",
  jp: "JP",
  au: "AU",
} as const;
const BEDROCK_REGION_ORDER = ["default", "global", "us", "eu", "jp", "au"] as const;
const BEDROCK_REGION_PREFIX_REGEX = /^(global|us|eu|jp|au)\./;
const REGION_SUFFIX_REGEX = /\s\((Global|US|EU|JP|AU)\)$/i;
const REGION_VENDOR_PREFIX_REGEX = /^(Global|US|EU|JP|AU)\s+Anthropic\s+/i;

export type BedrockRegionCode = keyof typeof BEDROCK_REGION_LABELS;

export interface ModelRegionOption<
  T extends ModelGroupingItem = ModelGroupingItem,
  R extends string = BedrockRegionCode,
> {
  id: string;
  label: string;
  model: T;
  region: R;
}

export interface RegionalModelListEntry<
  T extends ModelGroupingItem = ModelGroupingItem,
  R extends string = BedrockRegionCode,
> {
  model: T;
  regionOptions: ModelRegionOption<T, R>[];
}

export interface ModelProviderListEntry<T extends ModelGroupingItem = ModelGroupingItem> {
  key: string;
  label: string;
  models: RegionalModelListEntry<T>[];
}

interface BedrockRegionInfo {
  baseModelId: string;
  region: BedrockRegionCode;
}

export function getModelGroupingDisplayName(
  model: Pick<ModelGroupingItem, "matchingModel" | "name">,
) {
  return model.name || model.matchingModel;
}

function getBedrockRegionInfo(model: ModelGroupingItem): BedrockRegionInfo | null {
  if (model.provider !== BEDROCK_PROVIDER) {
    return null;
  }

  const modelId = model.matchingModel || model.id;
  const regionMatch = BEDROCK_REGION_PREFIX_REGEX.exec(modelId);

  if (!regionMatch) {
    return {
      baseModelId: modelId,
      region: "default",
    };
  }

  return {
    baseModelId: modelId.slice(regionMatch[0].length),
    region: regionMatch[1] as BedrockRegionCode,
  };
}

function getRegionSortIndex(region: BedrockRegionCode) {
  const index = BEDROCK_REGION_ORDER.indexOf(region);

  return index === -1 ? BEDROCK_REGION_ORDER.length : index;
}

function compareRegionOptions<T extends ModelGroupingItem>(
  left: ModelRegionOption<T>,
  right: ModelRegionOption<T>,
) {
  const regionDifference = getRegionSortIndex(left.region) - getRegionSortIndex(right.region);

  if (regionDifference !== 0) {
    return regionDifference;
  }

  return getModelGroupingDisplayName(left.model).localeCompare(
    getModelGroupingDisplayName(right.model),
  );
}

function getPreferredRegionOption<T extends ModelGroupingItem>(options: ModelRegionOption<T>[]) {
  return [...options].sort(compareRegionOptions)[0];
}

export function getRegionalModelGroupingDisplayName(model: ModelGroupingItem) {
  return getModelGroupingDisplayName(model)
    .replace(REGION_SUFFIX_REGEX, "")
    .replace(REGION_VENDOR_PREFIX_REGEX, "")
    .trim();
}

function toRegionOption<T extends ModelGroupingItem>(
  model: T,
  region: BedrockRegionCode,
): ModelRegionOption<T> {
  return {
    id: model.id,
    label: BEDROCK_REGION_LABELS[region],
    model,
    region,
  };
}

function createGroupedRegionalEntry<T extends ModelGroupingItem>(
  options: ModelRegionOption<T>[],
): RegionalModelListEntry<T> {
  const sortedOptions = [...options].sort(compareRegionOptions);
  const primaryOption = getPreferredRegionOption(sortedOptions);
  const primaryModel = primaryOption.model;

  return {
    model: {
      ...primaryModel,
      name: getRegionalModelGroupingDisplayName(primaryModel),
    },
    regionOptions: sortedOptions,
  };
}

export function collapseRegionalModelVariants<T extends ModelGroupingItem>(
  models: readonly T[],
): RegionalModelListEntry<T>[] {
  const passthroughEntries: RegionalModelListEntry<T>[] = [];
  const bedrockGroups = new Map<string, ModelRegionOption<T>[]>();

  for (const model of models) {
    const regionInfo = getBedrockRegionInfo(model);

    if (!regionInfo) {
      passthroughEntries.push({ model, regionOptions: [] });
      continue;
    }

    const options = bedrockGroups.get(regionInfo.baseModelId) ?? [];

    options.push(toRegionOption(model, regionInfo.region));
    bedrockGroups.set(regionInfo.baseModelId, options);
  }

  for (const options of bedrockGroups.values()) {
    const hasRegionalVariant = options.some((option) => option.region !== "default");

    if (options.length <= 1 || !hasRegionalVariant) {
      const model = options[0]?.model;

      if (model) {
        passthroughEntries.push({ model, regionOptions: [] });
      }

      continue;
    }

    passthroughEntries.push(createGroupedRegionalEntry(options));
  }

  return passthroughEntries.sort((left, right) =>
    getRegionalModelGroupingDisplayName(left.model).localeCompare(
      getRegionalModelGroupingDisplayName(right.model),
    ),
  );
}

export function getSelectedModelProvider(
  models: readonly ModelGroupingItem[],
  selectedId?: string | null,
) {
  if (!selectedId) {
    return null;
  }

  const selected = models.find((model) => model.id === selectedId);

  return selected?.kind === "agent" ? AGENT_MODEL_GROUP_KEY : selected?.provider || null;
}

export function getSelectedRegionalModelId<T extends ModelGroupingItem>(
  entry: RegionalModelListEntry<T>,
  selectedId?: string | null,
) {
  if (selectedId && entry.regionOptions.some((option) => option.id === selectedId)) {
    return selectedId;
  }

  return entry.model.id;
}

export function isRegionalModelEntrySelected<T extends ModelGroupingItem>(
  entry: RegionalModelListEntry<T>,
  selectedId?: string | null,
) {
  if (!selectedId) {
    return false;
  }

  return (
    entry.model.id === selectedId || entry.regionOptions.some((option) => option.id === selectedId)
  );
}

export function groupModelsByProvider<T extends ModelGroupingItem>(
  models: readonly T[],
  featuredModelIds: Readonly<Record<string, T>>,
): ModelProviderListEntry<T>[] {
  const featuredModels = models
    .filter((model) => featuredModelIds[model.id])
    .sort((left, right) =>
      getModelGroupingDisplayName(left).localeCompare(getModelGroupingDisplayName(right)),
    );
  const groupedByProvider = models.reduce<Record<string, T[]>>((groups, model) => {
    const provider = model.kind === "agent" ? AGENT_MODEL_GROUP_KEY : model.provider || "unknown";

    groups[provider] ??= [];
    groups[provider].push(model);

    return groups;
  }, {});
  const providerLists = Object.entries(groupedByProvider)
    .sort(([providerA], [providerB]) => {
      if (providerA === AGENT_MODEL_GROUP_KEY) {
        return -1;
      }

      if (providerB === AGENT_MODEL_GROUP_KEY) {
        return 1;
      }

      return providerA.localeCompare(providerB);
    })
    .map(([provider, providerModels]) => {
      const sortedModels = [...providerModels].sort((left, right) =>
        getModelGroupingDisplayName(left).localeCompare(getModelGroupingDisplayName(right)),
      );

      return {
        key: provider,
        label: provider === AGENT_MODEL_GROUP_KEY ? "Agents" : titleCaseSlug(provider),
        models: collapseRegionalModelVariants(sortedModels),
      };
    });

  return featuredModels.length > 0
    ? [
        {
          key: FEATURED_MODEL_GROUP_KEY,
          label: "Featured",
          models: collapseRegionalModelVariants(featuredModels),
        },
        ...providerLists,
      ]
    : providerLists;
}

export function partitionDeprecatedModelEntries<T extends ModelGroupingItem>(
  models: readonly RegionalModelListEntry<T>[],
) {
  return {
    active: models.filter((entry) => !entry.model.deprecated),
    deprecated: models.filter((entry) => entry.model.deprecated),
  };
}
