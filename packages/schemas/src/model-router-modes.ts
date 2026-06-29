import type { ModelConfigItem, ModelModality } from "./models";
import type { ModelRouterMode } from "./chat-completions";

const advancedStrengths: ModelModality[] = [
	"reasoning",
	"analysis",
	"coding",
	"agents",
	"tool_use",
];

function combinedTokenCost(model: ModelConfigItem) {
	return (model.costPer1kInputTokens ?? 0) + (model.costPer1kOutputTokens ?? 0);
}

function hasAnyStrength(model: ModelConfigItem, strengths: ModelModality[]) {
	return strengths.some((strength) => model.strengths?.includes(strength));
}

export function isActiveRouterModel(model: ModelConfigItem) {
	return Boolean(model.includedInRouter) && !model.deprecated;
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
			return (
				(model.contextComplexity ?? 3) >= 3 &&
				(model.contextComplexity ?? 3) <= 4 &&
				(model.speed ?? 3) >= 3 &&
				(cost === 0 || cost <= 0.05)
			);
		case "pro":
			return (
				(model.contextComplexity ?? 3) >= 4 &&
				(model.speed ?? 3) >= 2 &&
				hasAnyStrength(model, advancedStrengths)
			);
		case "max":
			return (
				(model.contextComplexity ?? 3) >= 5 ||
				(model.reliability ?? 0) >= 5 ||
				(model.artificialAnalysis?.intelligenceIndex ?? 0) >= 30
			);
	}
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
