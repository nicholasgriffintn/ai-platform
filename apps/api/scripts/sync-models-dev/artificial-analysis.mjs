import { SUPPORTED_MODALITIES, UNPARSEABLE } from "./constants.mjs";
import {
	getPropertyAssignment,
	getStringPropertyValue,
	parseLiteralValue,
} from "./source-model-config.mjs";
import {
	averageDefined,
	clampRouterScore,
	readNumber,
	readRecord,
	scoreHigherIsBetter,
	scoreLowerIsBetter,
} from "./value-utils.mjs";

export function normaliseLookupKey(value) {
	if (!value) {
		return null;
	}

	const normalised = String(value)
		.toLowerCase()
		.replace(/\([^)]*\)/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return normalised || null;
}

export function addLookupKey(keys, value) {
	const key = normaliseLookupKey(value);
	if (key) {
		keys.add(key);
	}
}

export function addModelLookupKeys(keys, value) {
	if (!value) {
		return;
	}
	addLookupKey(keys, value);
	if (String(value).includes("/")) {
		addLookupKey(keys, String(value).split("/").at(-1));
	}
}

export function buildArtificialAnalysisLookup(models) {
	const lookup = new Map();

	for (const model of models) {
		const keys = new Set();
		addLookupKey(keys, model.id);
		addLookupKey(keys, model.name);
		addLookupKey(keys, model.slug);

		for (const key of keys) {
			if (!lookup.has(key)) {
				lookup.set(key, model);
			}
		}
	}

	return lookup;
}

export function findArtificialAnalysisModel({
	lookup,
	entry,
	remoteModel,
	remoteModelId,
	sourceFile,
}) {
	if (!lookup || lookup.size === 0) {
		return null;
	}

	const keys = new Set();
	addModelLookupKeys(keys, entry.modelKey);
	addModelLookupKeys(keys, remoteModelId);
	addModelLookupKeys(keys, getStringPropertyValue(entry.objectNode, "matchingModel", sourceFile));
	addModelLookupKeys(keys, getStringPropertyValue(entry.objectNode, "name", sourceFile));
	if (remoteModel && typeof remoteModel === "object") {
		addModelLookupKeys(keys, remoteModel.id);
		addModelLookupKeys(keys, remoteModel.name);
	}

	for (const key of keys) {
		const analysisModel = lookup.get(key);
		if (analysisModel) {
			return analysisModel;
		}
	}
	return null;
}

export function deriveArtificialAnalysisScores(model) {
	const evaluations = readRecord(model.evaluations);
	const derivedScores = readRecord(model.derived_scores);
	const intelligence =
		readNumber(derivedScores.intelligence) ??
		scoreHigherIsBetter(
			readNumber(model.intelligence_index) ??
				readNumber(evaluations.artificial_analysis_intelligence_index),
			[80, 65, 50, 35],
		);
	const coding =
		readNumber(derivedScores.coding) ??
		scoreHigherIsBetter(
			readNumber(model.coding_index) ?? readNumber(evaluations.artificial_analysis_coding_index),
			[80, 60, 45, 30],
		);
	const agentic =
		readNumber(derivedScores.agentic) ??
		scoreHigherIsBetter(
			readNumber(model.agentic_index) ?? readNumber(evaluations.artificial_analysis_agentic_index),
			[80, 65, 50, 35],
		);
	const outputSpeed =
		readNumber(derivedScores.outputSpeed) ??
		scoreHigherIsBetter(readNumber(model.median_output_tokens_per_second), [180, 100, 50, 20]);
	const firstTokenLatency =
		readNumber(derivedScores.firstTokenLatency) ??
		scoreLowerIsBetter(readNumber(model.median_time_to_first_token_seconds), [0.5, 1, 3, 8]);

	return {
		intelligence,
		coding,
		agentic,
		outputSpeed,
		firstTokenLatency,
	};
}

export function pushStrength(strengths, value, enabled) {
	if (enabled && SUPPORTED_MODALITIES.has(value) && !strengths.includes(value)) {
		strengths.push(value);
	}
}

export function getExistingFieldValue(objectNode, propertyName, sourceFile) {
	if (!objectNode || !sourceFile) {
		return undefined;
	}

	const property = getPropertyAssignment(objectNode, propertyName, sourceFile);
	if (!property) {
		return undefined;
	}

	const parsed = parseLiteralValue(property.initializer, sourceFile);
	return parsed === UNPARSEABLE ? undefined : parsed;
}

export function buildEffectiveModelProfile(objectNode, sourceFile, baseValues = {}) {
	const profile = {};
	for (const fieldName of [
		"modalities",
		"supportsAttachments",
		"supportsToolCalls",
		"supportsResponseFormat",
		"supportsSearchGrounding",
		"supportsCodeExecution",
		"supportsWebFetch",
		"supportsDocuments",
		"supportsAudio",
		"supportsArtifacts",
		"contextWindow",
		"maxTokens",
		"costPer1kInputTokens",
		"costPer1kOutputTokens",
		"reasoningConfig",
		"strengths",
	]) {
		const existingValue = getExistingFieldValue(objectNode, fieldName, sourceFile);
		if (existingValue !== undefined) {
			profile[fieldName] = existingValue;
		}
		if (baseValues[fieldName] !== undefined) {
			profile[fieldName] = baseValues[fieldName];
		}
	}
	return profile;
}

export function modalityListIncludes(modalities, sectionName, value) {
	const values = modalities?.[sectionName];
	return Array.isArray(values) && values.includes(value);
}

export function deriveCapabilityScores(profile) {
	const contextWindow = readNumber(profile.contextWindow);
	const maxTokens = readNumber(profile.maxTokens);
	const modalities =
		profile.modalities && typeof profile.modalities === "object" ? profile.modalities : undefined;
	const supportsRichInput =
		modalityListIncludes(modalities, "input", "image") ||
		modalityListIncludes(modalities, "input", "pdf") ||
		modalityListIncludes(modalities, "input", "document") ||
		modalityListIncludes(modalities, "input", "audio") ||
		modalityListIncludes(modalities, "input", "video") ||
		profile.supportsAttachments === true ||
		profile.supportsDocuments === true ||
		profile.supportsAudio === true;
	const supportsTools =
		profile.supportsToolCalls === true ||
		profile.supportsSearchGrounding === true ||
		profile.supportsCodeExecution === true ||
		profile.supportsWebFetch === true;

	return {
		contextWindow: scoreHigherIsBetter(contextWindow, [1_000_000, 200_000, 128_000, 32_000]),
		maxTokens: scoreHigherIsBetter(maxTokens, [128_000, 64_000, 32_000, 8_000]),
		richInput: supportsRichInput ? 4 : undefined,
		tools: supportsTools ? 4 : undefined,
	};
}

export function deriveArtificialAnalysisStrengths(model, scores, profile) {
	const existingStrengths = Array.isArray(profile.strengths) ? profile.strengths : [];
	const strengths = existingStrengths.filter(
		(value) => typeof value === "string" && SUPPORTED_MODALITIES.has(value),
	);
	const derivedStrengths = Array.isArray(model.derived_strengths) ? model.derived_strengths : [];
	const modalities =
		profile.modalities && typeof profile.modalities === "object" ? profile.modalities : undefined;

	for (const strength of derivedStrengths) {
		pushStrength(strengths, strength, true);
	}

	pushStrength(strengths, "vision", modalityListIncludes(modalities, "input", "image"));
	pushStrength(strengths, "document", modalityListIncludes(modalities, "input", "pdf"));
	pushStrength(strengths, "document", modalityListIncludes(modalities, "input", "document"));
	pushStrength(strengths, "audio", modalityListIncludes(modalities, "input", "audio"));
	pushStrength(strengths, "video", modalityListIncludes(modalities, "input", "video"));
	pushStrength(strengths, "document", profile.supportsAttachments === true);
	pushStrength(strengths, "document", profile.supportsDocuments === true);
	pushStrength(strengths, "tool_use", profile.supportsToolCalls === true);
	pushStrength(strengths, "search", profile.supportsSearchGrounding === true);
	pushStrength(strengths, "research", profile.supportsWebFetch === true);
	pushStrength(strengths, "coding", profile.supportsCodeExecution === true);
	pushStrength(strengths, "audio", profile.supportsAudio === true);
	pushStrength(strengths, "general_knowledge", (scores.intelligence ?? 0) >= 4);
	pushStrength(strengths, "analysis", (scores.intelligence ?? 0) >= 4);
	pushStrength(strengths, "reasoning", (scores.intelligence ?? 0) >= 4);
	pushStrength(strengths, "coding", (scores.coding ?? 0) >= 4);
	pushStrength(strengths, "agents", (scores.agentic ?? 0) >= 4);
	pushStrength(strengths, "instruction", (scores.agentic ?? 0) >= 4);

	return strengths;
}

export function per1kFromPer1m(value) {
	const numberValue = readNumber(value);
	return numberValue === undefined
		? undefined
		: Number.parseFloat((numberValue / 1000).toFixed(10));
}

export function buildArtificialAnalysisUpdateValues(
	model,
	objectNode,
	sourceFile,
	baseValues = {},
) {
	if (!model) {
		return {};
	}

	const evaluations = readRecord(model.evaluations);
	const scores = deriveArtificialAnalysisScores(model);
	const profile = buildEffectiveModelProfile(objectNode, sourceFile, baseValues);
	const capabilityScores = deriveCapabilityScores(profile);
	const values = {
		artificialAnalysis: {
			intelligenceIndex:
				readNumber(model.intelligence_index) ??
				readNumber(evaluations.artificial_analysis_intelligence_index) ??
				null,
			codingIndex:
				readNumber(model.coding_index) ??
				readNumber(evaluations.artificial_analysis_coding_index) ??
				null,
			agenticIndex:
				readNumber(model.agentic_index) ??
				readNumber(evaluations.artificial_analysis_agentic_index) ??
				null,
			intelligenceIndexVersion: readNumber(model.intelligence_index_version) ?? null,
		},
	};

	const strengths = deriveArtificialAnalysisStrengths(model, scores, profile);
	if (strengths.length > 0) {
		values.strengths = strengths;
	}

	const contextComplexity = clampRouterScore(
		Math.max(
			scores.intelligence ?? 0,
			scores.coding ?? 0,
			scores.agentic ?? 0,
			averageDefined([
				capabilityScores.contextWindow,
				capabilityScores.maxTokens,
				capabilityScores.richInput,
				capabilityScores.tools,
			]) ?? 0,
		) || undefined,
	);
	if (contextComplexity !== undefined) {
		values.contextComplexity = contextComplexity;
	}

	const reliability = clampRouterScore(
		averageDefined([scores.intelligence, scores.coding, scores.agentic]),
	);
	if (reliability !== undefined) {
		values.reliability = reliability;
	}

	const speed = clampRouterScore(
		averageDefined([scores.outputSpeed, scores.outputSpeed, scores.firstTokenLatency]),
	);
	if (speed !== undefined) {
		values.speed = speed;
	}

	const inputCost = per1kFromPer1m(model.price_1m_input_tokens);
	if (inputCost !== undefined && readNumber(profile.costPer1kInputTokens) === undefined) {
		values.costPer1kInputTokens = inputCost;
	}

	const outputCost = per1kFromPer1m(model.price_1m_output_tokens);
	if (outputCost !== undefined && readNumber(profile.costPer1kOutputTokens) === undefined) {
		values.costPer1kOutputTokens = outputCost;
	}

	return values;
}
