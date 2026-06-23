import {
	CURRENT_ALIAS_SUFFIX_REGEX,
	IGNORED_REMOTE_MODEL_IDS,
	LATEST_TAGS,
	OUTDATED_TAGS,
	VERSION_SUFFIX_REGEX,
} from "./constants.mjs";
import { getStringPropertyValue } from "./source-model-config.mjs";

export function hasDeprecatedStatus(remoteConfig) {
	return (
		remoteConfig !== null &&
		typeof remoteConfig === "object" &&
		remoteConfig.status === "deprecated"
	);
}

export function normalizeTags(remoteModel) {
	if (!remoteModel || typeof remoteModel !== "object") {
		return [];
	}
	const tags = remoteModel.tags;
	if (!Array.isArray(tags)) {
		return [];
	}
	return tags.filter((tag) => typeof tag === "string").map((tag) => tag.toLowerCase());
}

export function hasAnyTag(remoteModel, tagSet) {
	return normalizeTags(remoteModel).some((tag) => tagSet.has(tag));
}

export function isIgnoredRemoteModelId(provider, modelId) {
	return IGNORED_REMOTE_MODEL_IDS[provider]?.has(modelId) ?? false;
}

export function anthropicModelFamilyKey(modelId) {
	if (!modelId.startsWith("claude-")) {
		return modelId;
	}

	const tokens = modelId
		.replace(/^claude-/, "")
		.replace(/-(latest|0)$/i, "")
		.replace(/-20\d{6}$/i, "")
		.split(/[-.]/);
	const modelClass = tokens.find((token) => ["opus", "sonnet", "haiku"].includes(token));
	if (!modelClass) {
		return modelId;
	}

	const versionTokens = tokens.filter((token) => /^\d+$/.test(token) && token.length < 6);
	if (versionTokens[1] === "0") {
		return `claude-${modelClass}-${versionTokens[0]}`;
	}
	if (versionTokens.length > 0) {
		return `claude-${modelClass}-${versionTokens.slice(0, 2).join("-")}`;
	}

	return `claude-${modelClass}`;
}

export function modelFamilyKey(modelId, provider) {
	if (provider === "anthropic") {
		return anthropicModelFamilyKey(modelId);
	}

	const match = VERSION_SUFFIX_REGEX.exec(modelId);
	if (match) {
		return match[1];
	}
	const currentAliasMatch = CURRENT_ALIAS_SUFFIX_REGEX.exec(modelId);
	return currentAliasMatch ? currentAliasMatch[1] : modelId;
}

export function getRemoteModelDateValue(remoteModel) {
	for (const fieldName of ["last_updated", "release_date"]) {
		const value = remoteModel[fieldName];
		if (typeof value !== "string") {
			continue;
		}
		const timestamp = Date.parse(value);
		if (Number.isFinite(timestamp)) {
			return timestamp;
		}
	}
	return undefined;
}

export function getVersionSuffixValue(modelId) {
	const match = VERSION_SUFFIX_REGEX.exec(modelId);
	if (!match) {
		return undefined;
	}
	return Number(match[2].replace(/\D/g, ""));
}

export function inferPreferredFamilyModelIds(modelIds, remoteModels, provider) {
	const unversionedModelIds = modelIds.filter(
		(modelId) => modelFamilyKey(modelId, provider) === modelId,
	);
	if (unversionedModelIds.length > 0) {
		return new Set(unversionedModelIds);
	}

	const currentAliasModelIds = modelIds.filter((modelId) => {
		return CURRENT_ALIAS_SUFFIX_REGEX.test(modelId);
	});
	if (currentAliasModelIds.length > 0) {
		return new Set(currentAliasModelIds);
	}

	let bestScore = Number.NEGATIVE_INFINITY;
	const preferredModelIds = new Set();
	for (const modelId of modelIds) {
		const remoteModel = remoteModels[modelId];
		const dateValue = getRemoteModelDateValue(remoteModel);
		const versionValue = getVersionSuffixValue(modelId);
		const score = dateValue ?? versionValue;
		if (score === undefined) {
			preferredModelIds.add(modelId);
			continue;
		}
		if (score > bestScore) {
			bestScore = score;
			preferredModelIds.clear();
			preferredModelIds.add(modelId);
			continue;
		}
		if (score === bestScore) {
			preferredModelIds.add(modelId);
		}
	}

	return preferredModelIds;
}

export function buildProviderModelFamilies(remoteModels, provider) {
	const families = new Map();
	for (const [modelId, remoteModel] of Object.entries(remoteModels)) {
		if (!remoteModel || typeof remoteModel !== "object") {
			continue;
		}
		if (isIgnoredRemoteModelId(provider, modelId)) {
			continue;
		}
		const family = modelFamilyKey(modelId, provider);
		if (!families.has(family)) {
			families.set(family, new Set());
		}
		families.get(family).add(modelId);
	}
	return families;
}

export function buildProviderModelStatus(remoteModels, provider) {
	const latestModelIds = new Set();
	const outdatedModelIds = new Set();
	const familyMembers = new Map();
	const familyLatestModelIds = new Map();

	for (const [modelId, remoteModel] of Object.entries(remoteModels)) {
		if (!remoteModel || typeof remoteModel !== "object") {
			continue;
		}
		if (isIgnoredRemoteModelId(provider, modelId)) {
			continue;
		}
		const family = modelFamilyKey(modelId, provider);
		if (!familyMembers.has(family)) {
			familyMembers.set(family, []);
		}
		familyMembers.get(family).push(modelId);

		if (hasDeprecatedStatus(remoteModel) || hasAnyTag(remoteModel, OUTDATED_TAGS)) {
			outdatedModelIds.add(modelId);
		}
		if (
			remoteModel.latest === true ||
			remoteModel.is_latest === true ||
			hasAnyTag(remoteModel, LATEST_TAGS)
		) {
			latestModelIds.add(modelId);
			if (!familyLatestModelIds.has(family)) {
				familyLatestModelIds.set(family, new Set());
			}
			familyLatestModelIds.get(family).add(modelId);
		}
	}

	for (const [family, modelIds] of familyMembers) {
		if (familyLatestModelIds.has(family)) {
			const familyLatestIds = familyLatestModelIds.get(family);
			for (const modelId of modelIds) {
				if (!familyLatestIds.has(modelId)) {
					outdatedModelIds.add(modelId);
				}
			}
			continue;
		}

		if (modelIds.length > 1) {
			const preferredModelIds = inferPreferredFamilyModelIds(modelIds, remoteModels, provider);
			for (const modelId of modelIds) {
				if (!preferredModelIds.has(modelId)) {
					outdatedModelIds.add(modelId);
				}
			}
		}
	}

	return { latestModelIds, outdatedModelIds };
}

export function isCurrentAliasModelId(modelId) {
	return CURRENT_ALIAS_SUFFIX_REGEX.test(modelId);
}

export function getEntryModelIds(entry, sourceFile) {
	const matchingModel = getStringPropertyValue(entry.objectNode, "matchingModel", sourceFile);
	return matchingModel ? [entry.modelKey, matchingModel] : [entry.modelKey];
}

export function shouldProtectCurrentAlias(provider, modelId) {
	return isCurrentAliasModelId(modelId);
}

export function getCurrentAliasFamilies(entries, sourceFile, provider) {
	const families = new Set();
	for (const entry of entries) {
		for (const modelId of getEntryModelIds(entry, sourceFile)) {
			if (shouldProtectCurrentAlias(provider, modelId)) {
				families.add(modelFamilyKey(modelId, provider));
			}
		}
	}
	return families;
}

export function isProtectedCurrentAliasEntry(entry, provider) {
	return shouldProtectCurrentAlias(provider, entry.modelKey);
}

export function remoteModelIsRepresentedByCurrentAlias(remoteModelId, currentAliasFamilies) {
	for (const currentAliasFamily of currentAliasFamilies) {
		if (
			remoteModelId === currentAliasFamily ||
			remoteModelId.startsWith(`${currentAliasFamily}-`)
		) {
			return true;
		}
	}
	return false;
}

export function isStaleUnmatchedFamilyEntry({
	remoteModel,
	remoteModelId,
	remoteModelFamilies,
	provider,
	currentAliasFamilies,
}) {
	if (remoteModel && typeof remoteModel === "object") {
		return false;
	}
	const family = modelFamilyKey(remoteModelId, provider);
	if (currentAliasFamilies.has(family)) {
		return false;
	}
	return remoteModelFamilies.has(family);
}

export function remoteModelsFromProvider(remoteProviderConfig) {
	if (!remoteProviderConfig || typeof remoteProviderConfig !== "object") {
		return null;
	}
	if (!remoteProviderConfig.models || typeof remoteProviderConfig.models !== "object") {
		return null;
	}
	return remoteProviderConfig.models;
}
