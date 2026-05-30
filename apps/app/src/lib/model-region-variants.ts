import type { ModelConfigItem } from "~/types";
import { getModelDisplayName } from "./models";

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
const REGION_SUFFIX_REGEX = /\s+\((Global|US|EU|JP|AU)\)$/i;
const REGION_VENDOR_PREFIX_REGEX = /^(Global|US|EU|JP|AU)\s+Anthropic\s+/i;

type BedrockRegionCode = keyof typeof BEDROCK_REGION_LABELS;

export interface ModelRegionOption {
	id: string;
	label: string;
	model: ModelConfigItem;
	region: BedrockRegionCode;
}

export interface RegionalModelListEntry {
	model: ModelConfigItem;
	regionOptions: ModelRegionOption[];
}

interface BedrockRegionInfo {
	baseModelId: string;
	region: BedrockRegionCode;
}

function getBedrockRegionInfo(model: ModelConfigItem): BedrockRegionInfo | null {
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

function compareRegionOptions(left: ModelRegionOption, right: ModelRegionOption) {
	const regionDifference = getRegionSortIndex(left.region) - getRegionSortIndex(right.region);
	if (regionDifference !== 0) {
		return regionDifference;
	}
	return getModelDisplayName(left.model).localeCompare(getModelDisplayName(right.model));
}

function getPreferredRegionOption(options: ModelRegionOption[]) {
	return [...options].sort(compareRegionOptions)[0];
}

export function getRegionalModelDisplayName(model: ModelConfigItem) {
	return getModelDisplayName(model)
		.replace(REGION_SUFFIX_REGEX, "")
		.replace(REGION_VENDOR_PREFIX_REGEX, "")
		.trim();
}

function toRegionOption(model: ModelConfigItem, region: BedrockRegionCode): ModelRegionOption {
	return {
		id: model.id,
		label: BEDROCK_REGION_LABELS[region],
		model,
		region,
	};
}

function createGroupedRegionalEntry(options: ModelRegionOption[]): RegionalModelListEntry {
	const sortedOptions = [...options].sort(compareRegionOptions);
	const primaryOption = getPreferredRegionOption(sortedOptions);
	const primaryModel = primaryOption.model;

	return {
		model: {
			...primaryModel,
			name: getRegionalModelDisplayName(primaryModel),
		},
		regionOptions: sortedOptions,
	};
}

export function collapseRegionalModelVariants(models: ModelConfigItem[]): RegionalModelListEntry[] {
	const passthroughEntries: RegionalModelListEntry[] = [];
	const bedrockGroups = new Map<string, ModelRegionOption[]>();

	for (const model of models) {
		const regionInfo = getBedrockRegionInfo(model);
		if (!regionInfo) {
			passthroughEntries.push({
				model,
				regionOptions: [],
			});
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
				passthroughEntries.push({
					model,
					regionOptions: [],
				});
			}
			continue;
		}

		passthroughEntries.push(createGroupedRegionalEntry(options));
	}

	return passthroughEntries.sort((left, right) =>
		getRegionalModelDisplayName(left.model).localeCompare(getRegionalModelDisplayName(right.model)),
	);
}

export function getSelectedRegionalModelId(
	entry: RegionalModelListEntry,
	selectedId?: string | null,
) {
	if (selectedId && entry.regionOptions.some((option) => option.id === selectedId)) {
		return selectedId;
	}
	return entry.model.id;
}

export function isRegionalModelEntrySelected(
	entry: RegionalModelListEntry,
	selectedId?: string | null,
) {
	if (!selectedId) {
		return false;
	}
	return (
		entry.model.id === selectedId || entry.regionOptions.some((option) => option.id === selectedId)
	);
}
