import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { PROVIDER_ALIASES } from "./constants.mjs";
import { API_ROOT } from "./paths.mjs";
import {
	addModelLookupKeys,
	buildArtificialAnalysisUpdateValues,
	findArtificialAnalysisModel,
} from "./artificial-analysis.mjs";
import { buildUpdateValues } from "./model-values.mjs";
import {
	applyPatches,
	buildObjectPatches,
	buildRemoveEntryPatch,
	formatNewArrayEntry,
	formatNewObjectEntry,
} from "./model-patches.mjs";
import {
	buildProviderModelFamilies,
	buildProviderModelStatus,
	getCurrentAliasFamilies,
	hasDeprecatedStatus,
	isIgnoredRemoteModelId,
	isProtectedCurrentAliasEntry,
	isStaleUnmatchedFamilyEntry,
	remoteModelIsRepresentedByCurrentAlias,
	remoteModelsFromProvider,
	shouldProtectCurrentAlias,
} from "./remote-model-status.mjs";
import {
	extractArrayEntries,
	extractObjectEntries,
	findModelConfigDeclaration,
	findProviderFromConstant,
	getIndentAtPosition,
	getLineStart,
	getReasoningOverrideModelIds,
	getStringPropertyValue,
	inferProviderFromObjectEntries,
} from "./source-model-config.mjs";
import { hasOwn } from "./value-utils.mjs";

export async function listTsFiles(dir) {
	const results = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await listTsFiles(fullPath)));
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".ts")) {
			results.push(fullPath);
		}
	}

	return results;
}

export function shouldProcessProvider(localProvider, remoteProvider, selectedProviders) {
	if (selectedProviders.size === 0) {
		return true;
	}
	return selectedProviders.has(localProvider) || selectedProviders.has(remoteProvider);
}

export function shouldUpdateMatchingModel({ modelKey, existingMatchingModel, remoteModelId }) {
	if (!existingMatchingModel) {
		return true;
	}
	return existingMatchingModel === modelKey || existingMatchingModel === remoteModelId;
}

export function resolveEntryRemoteModel(entry, remoteModels, sourceFile) {
	const matchingModel = getStringPropertyValue(entry.objectNode, "matchingModel", sourceFile);
	const remoteModel =
		remoteModels[entry.modelKey] ?? (matchingModel ? remoteModels[matchingModel] : undefined);
	const remoteModelId =
		typeof remoteModel?.id === "string" ? remoteModel.id : (matchingModel ?? entry.modelKey);

	return { matchingModel, remoteModel, remoteModelId };
}

export function getEntryIndentFromNodes(fileText, nodes, fallbackIndentBasePosition) {
	if (nodes.length > 0) {
		return getIndentAtPosition(fileText, nodes[0].getStart());
	}
	const baseIndent = getIndentAtPosition(fileText, fallbackIndentBasePosition);
	return `${baseIndent}\t`;
}

export function findDuplicateRemoteModelEntryNodes(entries, remoteModels, sourceFile) {
	const preferredEntriesByResolvedModelId = new Map();
	const duplicateEntryNodes = new Set();

	for (const entry of entries) {
		const { remoteModelId } = resolveEntryRemoteModel(entry, remoteModels, sourceFile);

		const existingEntry = preferredEntriesByResolvedModelId.get(remoteModelId);
		if (!existingEntry) {
			preferredEntriesByResolvedModelId.set(remoteModelId, entry);
			continue;
		}

		if (entry.modelKey === remoteModelId && existingEntry.modelKey !== remoteModelId) {
			duplicateEntryNodes.add(existingEntry.entryNode);
			preferredEntriesByResolvedModelId.set(remoteModelId, entry);
			continue;
		}

		duplicateEntryNodes.add(entry.entryNode);
	}

	return duplicateEntryNodes;
}

export async function inspectModelFile({ filePath, remoteProviders, selectedProviders }) {
	const originalText = await fs.readFile(filePath, "utf8");
	const sourceFile = ts.createSourceFile(
		filePath,
		originalText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);

	const declaration = findModelConfigDeclaration(sourceFile);
	if (!declaration) {
		return {
			filePath,
			status: "skipped",
			reason: "no-model-config-declaration",
		};
	}

	let localProvider = null;
	let entries = [];
	let containerNode = null;
	let containerElements = [];

	if (declaration.style === "array") {
		localProvider = findProviderFromConstant(sourceFile);
		entries = extractArrayEntries(declaration.arrayNode, sourceFile);
		containerNode = declaration.arrayNode;
		containerElements = declaration.arrayNode.elements;
	} else {
		entries = extractObjectEntries(declaration.objectNode, sourceFile);
		localProvider = inferProviderFromObjectEntries(entries, sourceFile);
		containerNode = declaration.objectNode;
		containerElements = declaration.objectNode.properties;
	}

	if (!localProvider) {
		return {
			filePath,
			status: "skipped",
			reason: "provider-not-found",
		};
	}

	const remoteProviderId = PROVIDER_ALIASES[localProvider] ?? localProvider;
	if (!shouldProcessProvider(localProvider, remoteProviderId, selectedProviders)) {
		return {
			filePath,
			status: "skipped",
			reason: "provider-filtered",
			localProvider,
			remoteProviderId,
		};
	}

	const remoteProviderConfig = remoteProviders[remoteProviderId];
	const remoteProviderDeprecated = hasDeprecatedStatus(remoteProviderConfig);
	const remoteModels = remoteModelsFromProvider(remoteProviderConfig);
	const providerModelStatus = buildProviderModelStatus(remoteModels ?? {}, remoteProviderId);
	const remoteModelFamilies = buildProviderModelFamilies(remoteModels ?? {}, remoteProviderId);
	if (!remoteModels && !remoteProviderDeprecated) {
		return {
			filePath,
			status: "skipped",
			reason: "remote-provider-missing",
			localProvider,
			remoteProviderId,
		};
	}

	const representedRemoteModelIds = new Set();
	for (const entry of entries) {
		if (remoteModels && hasOwn(remoteModels, entry.modelKey)) {
			representedRemoteModelIds.add(entry.modelKey);
		}
		const matchingModel = getStringPropertyValue(entry.objectNode, "matchingModel", sourceFile);
		if (matchingModel && remoteModels && hasOwn(remoteModels, matchingModel)) {
			representedRemoteModelIds.add(matchingModel);
		}
		for (const overrideModelId of getReasoningOverrideModelIds(entry.objectNode, sourceFile)) {
			if (remoteModels && hasOwn(remoteModels, overrideModelId)) {
				representedRemoteModelIds.add(overrideModelId);
			}
		}
	}

	return {
		filePath,
		status: "processable",
		originalText,
		sourceFile,
		declaration,
		localProvider,
		remoteProviderId,
		remoteProviderDeprecated,
		remoteModels: remoteModels ?? {},
		providerModelStatus,
		remoteModelFamilies,
		entries,
		containerNode,
		containerElements,
		representedRemoteModelIds,
	};
}

export async function processFile({
	filePath,
	remoteProviders,
	artificialAnalysisLookup,
	write,
	selectedProviders,
	verbose,
	providerRepresentedRemoteModelIds,
	allowAddingMissingModels,
}) {
	const inspection = await inspectModelFile({ filePath, remoteProviders, selectedProviders });
	if (inspection.status !== "processable") {
		return inspection;
	}

	const {
		originalText,
		sourceFile,
		declaration,
		localProvider,
		remoteProviderId,
		remoteProviderDeprecated,
		remoteModels,
		providerModelStatus,
		remoteModelFamilies,
		entries,
		containerNode,
		containerElements,
	} = inspection;

	const patches = [];
	let updatedExisting = 0;
	let updatedArtificialAnalysis = 0;
	let removedDeprecatedModels = 0;
	let removedDuplicateModels = 0;
	const duplicateEntryNodes = findDuplicateRemoteModelEntryNodes(entries, remoteModels, sourceFile);
	const currentAliasFamilies = getCurrentAliasFamilies(entries, sourceFile, remoteProviderId);

	for (const entry of entries) {
		const { matchingModel, remoteModel, remoteModelId } = resolveEntryRemoteModel(
			entry,
			remoteModels,
			sourceFile,
		);

		if (duplicateEntryNodes.has(entry.entryNode)) {
			removedDuplicateModels += 1;
			patches.push(buildRemoveEntryPatch(originalText, entry.entryNode, sourceFile));
			continue;
		}

		const isOutdatedModel = providerModelStatus.outdatedModelIds.has(remoteModelId);
		const shouldRemoveBecauseNotLatest =
			providerModelStatus.latestModelIds.size > 0 &&
			!providerModelStatus.latestModelIds.has(remoteModelId) &&
			!isProtectedCurrentAliasEntry(entry, remoteProviderId);
		if (
			remoteProviderDeprecated ||
			hasDeprecatedStatus(remoteModel) ||
			isOutdatedModel ||
			shouldRemoveBecauseNotLatest ||
			isStaleUnmatchedFamilyEntry({
				remoteModel,
				remoteModelId,
				remoteModelFamilies,
				provider: remoteProviderId,
				currentAliasFamilies,
			})
		) {
			removedDeprecatedModels += 1;
			patches.push(buildRemoveEntryPatch(originalText, entry.entryNode, sourceFile));
			continue;
		}

		if (!remoteModel || typeof remoteModel !== "object") {
			continue;
		}

		const values = buildUpdateValues(remoteModel, {
			modelKey: remoteModelId,
			existingMatchingModel: matchingModel,
			allowMatchingModelUpdate: shouldUpdateMatchingModel({
				modelKey: entry.modelKey,
				existingMatchingModel: matchingModel,
				remoteModelId,
			}),
			isNewEntry: false,
			includeProvider: false,
			provider: localProvider,
		});
		const artificialAnalysisModel = findArtificialAnalysisModel({
			lookup: artificialAnalysisLookup,
			entry,
			remoteModel,
			remoteModelId,
			sourceFile,
		});
		if (artificialAnalysisModel) {
			Object.assign(
				values,
				buildArtificialAnalysisUpdateValues(
					artificialAnalysisModel,
					entry.objectNode,
					sourceFile,
					values,
				),
			);
			updatedArtificialAnalysis += 1;
		}

		const entryPatches = buildObjectPatches({
			fileText: originalText,
			sourceFile,
			objectNode: entry.objectNode,
			values,
		});

		if (entryPatches.length > 0) {
			updatedExisting += 1;
			patches.push(...entryPatches);
		}
	}

	const representedRemoteModelIds =
		providerRepresentedRemoteModelIds ?? inspection.representedRemoteModelIds;

	const missingRemoteModelIds =
		allowAddingMissingModels && !remoteProviderDeprecated
			? Object.keys(remoteModels)
					.filter((remoteModelId) => !representedRemoteModelIds.has(remoteModelId))
					.filter((remoteModelId) => !isIgnoredRemoteModelId(remoteProviderId, remoteModelId))
					.filter((remoteModelId) => {
						return (
							!remoteModelIsRepresentedByCurrentAlias(remoteModelId, currentAliasFamilies) ||
							shouldProtectCurrentAlias(remoteProviderId, remoteModelId)
						);
					})
					.filter((remoteModelId) => !hasDeprecatedStatus(remoteModels[remoteModelId]))
					.filter((remoteModelId) => !providerModelStatus.outdatedModelIds.has(remoteModelId))
					.filter((remoteModelId) => {
						if (providerModelStatus.latestModelIds.size === 0) {
							return true;
						}
						return providerModelStatus.latestModelIds.has(remoteModelId);
					})
					.sort((left, right) => left.localeCompare(right))
			: [];

	const entryIndent = getEntryIndentFromNodes(
		originalText,
		containerElements,
		containerNode.getStart(sourceFile),
	);

	const newEntries = missingRemoteModelIds.map((remoteModelId) => {
		const remoteModel = remoteModels[remoteModelId];
		const values = buildUpdateValues(remoteModel, {
			modelKey: remoteModelId,
			existingMatchingModel: undefined,
			allowMatchingModelUpdate: true,
			isNewEntry: true,
			includeProvider: declaration.style === "object",
			provider: localProvider,
		});
		const analysisKeys = new Set();
		addModelLookupKeys(analysisKeys, remoteModelId);
		if (remoteModel && typeof remoteModel === "object") {
			addModelLookupKeys(analysisKeys, remoteModel.id);
			addModelLookupKeys(analysisKeys, remoteModel.name);
		}
		for (const key of analysisKeys) {
			const artificialAnalysisModel = artificialAnalysisLookup.get(key);
			if (artificialAnalysisModel) {
				Object.assign(
					values,
					buildArtificialAnalysisUpdateValues(
						artificialAnalysisModel,
						undefined,
						undefined,
						values,
					),
				);
				updatedArtificialAnalysis += 1;
				break;
			}
		}

		return declaration.style === "array"
			? formatNewArrayEntry(remoteModelId, values, entryIndent)
			: formatNewObjectEntry(remoteModelId, values, entryIndent);
	});

	if (newEntries.length > 0) {
		const closeTokenPosition = containerNode.end - 1;
		const insertionPoint = getLineStart(originalText, closeTokenPosition);
		patches.push({
			start: insertionPoint,
			end: insertionPoint,
			text: `${newEntries.join("\n\n")}\n`,
		});
	}

	if (patches.length === 0) {
		return {
			filePath,
			status: "unchanged",
			localProvider,
			remoteProviderId,
			updatedExisting: 0,
			updatedArtificialAnalysis: 0,
			addedModels: 0,
			removedDeprecatedModels: 0,
			removedDuplicateModels: 0,
		};
	}

	const nextText = applyPatches(originalText, patches);
	if (write) {
		await fs.writeFile(filePath, nextText, "utf8");
	}

	if (verbose) {
		const modeLabel = write ? "wrote" : "dry-run";
		console.log(
			`[${modeLabel}] ${path.relative(API_ROOT, filePath)} (${localProvider} -> ${remoteProviderId}) updated=${updatedExisting} added=${newEntries.length} removedDeprecated=${removedDeprecatedModels} removedDuplicates=${removedDuplicateModels}`,
		);
	}

	return {
		filePath,
		status: "changed",
		localProvider,
		remoteProviderId,
		updatedExisting,
		updatedArtificialAnalysis,
		addedModels: newEntries.length,
		removedDeprecatedModels,
		removedDuplicateModels,
	};
}
