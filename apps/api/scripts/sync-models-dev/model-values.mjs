import { SUPPORTED_MODALITIES } from "./constants.mjs";
import { hasOwn } from "./value-utils.mjs";

export function formatMonth(year, month) {
	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	return months[month - 1] ?? `${year}-${String(month).padStart(2, "0")}`;
}

export function formatHumanDate(value) {
	if (!value || typeof value !== "string") {
		return undefined;
	}

	const fullDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (fullDate) {
		const year = Number(fullDate[1]);
		const month = Number(fullDate[2]);
		const day = Number(fullDate[3]);
		return `${formatMonth(year, month)} ${day}, ${year}`;
	}

	const yearMonth = /^(\d{4})-(\d{2})$/.exec(value);
	if (yearMonth) {
		const year = Number(yearMonth[1]);
		const month = Number(yearMonth[2]);
		return `${formatMonth(year, month)} ${year}`;
	}

	return value;
}

export function normalizeModalityList(values) {
	if (!Array.isArray(values)) {
		return [];
	}
	const filtered = [];
	for (const value of values) {
		if (typeof value !== "string") {
			continue;
		}
		if (!SUPPORTED_MODALITIES.has(value)) {
			continue;
		}
		filtered.push(value);
	}
	return filtered;
}

export function normalizeModalities(modalities, { defaultToText } = { defaultToText: false }) {
	if (!modalities || typeof modalities !== "object") {
		if (!defaultToText) {
			return undefined;
		}
		return {
			input: ["text"],
			output: ["text"],
		};
	}

	const input = normalizeModalityList(modalities.input);
	const output = normalizeModalityList(modalities.output);

	if (input.length === 0) {
		if (!defaultToText) {
			return undefined;
		}
		return {
			input: ["text"],
			output: output.length > 0 ? output : ["text"],
		};
	}

	if (output.length === 0 && defaultToText) {
		return { input, output: ["text"] };
	}

	return output.length > 0 ? { input, output } : { input };
}

export function toPer1k(value) {
	if (typeof value !== "number" || Number.isNaN(value)) {
		return undefined;
	}
	const converted = value / 1000;
	const normalized = Number.parseFloat(converted.toFixed(10));
	return Number.isFinite(normalized) ? normalized : undefined;
}

export function buildUpdateValues(
	remoteModel,
	{
		modelKey,
		existingMatchingModel,
		allowMatchingModelUpdate,
		isNewEntry,
		includeProvider,
		provider,
	},
) {
	const values = {};
	const remoteId = typeof remoteModel.id === "string" ? remoteModel.id : modelKey;

	if (isNewEntry && typeof remoteModel.name === "string" && remoteModel.name.length > 0) {
		values.name = remoteModel.name;
	}

	if (allowMatchingModelUpdate || isNewEntry) {
		values.matchingModel = remoteId;
	} else if (!existingMatchingModel && remoteId) {
		values.matchingModel = remoteId;
	}

	if (includeProvider && provider) {
		values.provider = provider;
	}

	if (typeof remoteModel.family === "string" && remoteModel.family.length > 0) {
		values.family = remoteModel.family;
	}

	if (typeof remoteModel.status === "string" && remoteModel.status.length > 0) {
		values.status = remoteModel.status;
	}

	if (hasOwn(remoteModel, "open_weights")) {
		values.openWeights = Boolean(remoteModel.open_weights);
	}

	const knowledgeDate = formatHumanDate(remoteModel.knowledge);
	if (knowledgeDate) {
		values.knowledgeCutoffDate = knowledgeDate;
	}

	const releaseDate = formatHumanDate(remoteModel.release_date);
	if (releaseDate) {
		values.releaseDate = releaseDate;
	}

	const lastUpdated = formatHumanDate(remoteModel.last_updated);
	if (lastUpdated) {
		values.lastUpdated = lastUpdated;
	}

	const modalities = normalizeModalities(remoteModel.modalities, {
		defaultToText: isNewEntry,
	});
	if (modalities && isNewEntry) {
		values.modalities = modalities;
	}

	if (hasOwn(remoteModel, "attachment")) {
		values.supportsAttachments = Boolean(remoteModel.attachment);
	}
	if (hasOwn(remoteModel, "temperature")) {
		values.supportsTemperature = Boolean(remoteModel.temperature);
	}
	if (hasOwn(remoteModel, "tool_call")) {
		values.supportsToolCalls = Boolean(remoteModel.tool_call);
	}
	if (hasOwn(remoteModel, "structured_output")) {
		values.supportsResponseFormat = Boolean(remoteModel.structured_output);
	}

	if (remoteModel.limit && typeof remoteModel.limit === "object") {
		if (typeof remoteModel.limit.context === "number") {
			values.contextWindow = remoteModel.limit.context;
		}
		if (typeof remoteModel.limit.output === "number") {
			values.maxTokens = remoteModel.limit.output;
		}
	}

	if (remoteModel.cost && typeof remoteModel.cost === "object") {
		const inputCost = toPer1k(remoteModel.cost.input);
		if (inputCost !== undefined) {
			values.costPer1kInputTokens = inputCost;
		}

		const outputCost = toPer1k(remoteModel.cost.output);
		if (outputCost !== undefined) {
			values.costPer1kOutputTokens = outputCost;
		}

		const reasoningCost = toPer1k(remoteModel.cost.reasoning);
		if (reasoningCost !== undefined) {
			values.costPer1kReasoningTokens = reasoningCost;
		}
	}

	if (hasOwn(remoteModel, "reasoning") && remoteModel.reasoning) {
		values.reasoningConfig = {
			supportedEffortLevels: ["none", "thinking"],
			defaultEffort: "none",
		};
	}

	return values;
}
