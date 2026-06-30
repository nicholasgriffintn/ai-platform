import type { ModelConfigItem, ModelModality } from "./models";
import type { ModelRouterMode } from "./chat-completions";

const advancedStrengths: ModelModality[] = [
	"reasoning",
	"analysis",
	"coding",
	"agents",
	"tool_use",
];
const PRO_MIN_INTELLIGENCE_INDEX = 35;
const MAX_MIN_INTELLIGENCE_INDEX = 40;

function combinedTokenCost(model: ModelConfigItem) {
	return (model.costPer1kInputTokens ?? 0) + (model.costPer1kOutputTokens ?? 0);
}

function hasAnyStrength(model: ModelConfigItem, strengths: ModelModality[]) {
	return strengths.some((strength) => model.strengths?.includes(strength));
}

function intelligenceIndex(model: ModelConfigItem) {
	const value = model.artificialAnalysis?.intelligenceIndex;
	return typeof value === "number" ? value : null;
}

function modelName(model: ModelConfigItem) {
	return model.name || model.matchingModel;
}

function hasRequiredRouterScores(model: ModelConfigItem) {
	return (
		typeof model.contextComplexity === "number" &&
		typeof model.reliability === "number" &&
		typeof model.speed === "number"
	);
}

function isOpenRouterFreeModel(model: ModelConfigItem) {
	if (model.provider !== "openrouter") {
		return false;
	}

	return (
		Boolean(model.isFree) || model.matchingModel.endsWith(":free") || model.id?.endsWith(":free")
	);
}

export function isActiveRouterModel(model: ModelConfigItem) {
	return (
		!model.deprecated &&
		model.status !== "alpha" &&
		!isOpenRouterFreeModel(model) &&
		hasRequiredRouterScores(model)
	);
}

export function doesModelMatchRouterMode(model: ModelConfigItem, mode: ModelRouterMode) {
	if (mode === "auto") {
		return true;
	}

	const cost = combinedTokenCost(model);

	switch (mode) {
		case "lite":
			return (
				(model.speed ?? 0) >= 4 &&
				(cost === 0 || cost <= 0.01) &&
				(model.contextComplexity ?? 3) <= 4
			);
		case "standard":
			if ((intelligenceIndex(model) ?? 10) < 10) {
				return false;
			}

			return (
				(model.contextComplexity ?? 3) >= 3 &&
				(model.contextComplexity ?? 3) <= 4 &&
				(model.speed ?? 3) >= 3 &&
				(cost === 0 || cost <= 0.05)
			);
		case "pro": {
			if (
				(model.contextComplexity ?? 3) < 4 ||
				(model.speed ?? 3) < 2 ||
				!hasAnyStrength(model, advancedStrengths)
			) {
				return false;
			}

			const intelligence = intelligenceIndex(model);
			return intelligence === null
				? (model.reliability ?? 0) >= 4
				: intelligence >= PRO_MIN_INTELLIGENCE_INDEX;
		}
		case "max": {
			const intelligence = intelligenceIndex(model);
			if (intelligence !== null) {
				return intelligence >= MAX_MIN_INTELLIGENCE_INDEX && (model.contextComplexity ?? 3) >= 4;
			}

			return (model.contextComplexity ?? 3) >= 5 && (model.reliability ?? 0) >= 5;
		}
	}
}

export function getRouterModeFitScore(model: ModelConfigItem, mode: ModelRouterMode) {
	const intelligence = intelligenceIndex(model) ?? 0;
	const reliability = model.reliability ?? 0;
	const speed = model.speed ?? 0;
	const complexity = model.contextComplexity ?? 0;
	const strengthScore = advancedStrengths.filter((strength) =>
		model.strengths?.includes(strength),
	).length;
	const cost = combinedTokenCost(model);

	switch (mode) {
		case "lite":
			return speed * 20 + reliability * 4 - complexity * 2 - cost * 1000;
		case "standard":
			return speed * 10 + reliability * 8 + intelligence - Math.abs(3.5 - complexity) * 8;
		case "pro":
			return intelligence * 2 + complexity * 12 + reliability * 8 + strengthScore * 8;
		case "max":
			return intelligence * 3 + complexity * 14 + reliability * 10 + strengthScore * 4;
		case "auto":
			return intelligence + complexity * 10 + reliability * 8 + speed * 4 + strengthScore * 4;
	}
}

export function sortModelsByRouterModeFit<T extends ModelConfigItem>(
	models: readonly T[],
	mode: ModelRouterMode,
) {
	return [...models].sort((left, right) => {
		const scoreDelta = getRouterModeFitScore(right, mode) - getRouterModeFitScore(left, mode);
		if (scoreDelta !== 0) {
			return scoreDelta;
		}

		return modelName(left).localeCompare(modelName(right));
	});
}

export function filterModelsByRouterMode<T extends ModelConfigItem>(
	models: Record<string, T>,
	mode: ModelRouterMode,
) {
	if (mode === "auto") {
		return models;
	}

	return Object.fromEntries(
		Object.entries(models).filter(([, model]) => doesModelMatchRouterMode(model, mode)),
	);
}
