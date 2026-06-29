import {
	doesModelMatchRouterMode,
	isActiveRouterModel,
	type ModelConfigItem,
	type ModelRouterMode,
} from "@assistant/schemas";

export interface AutoRouterModeDefinition {
	id: ModelRouterMode;
	label: string;
	tagline: string;
	description: string;
	filterSummary: string;
}

export const AUTO_ROUTER_MODES: readonly AutoRouterModeDefinition[] = [
	{
		id: "auto",
		label: "Auto",
		tagline: "Let the router decide",
		description: "Uses the full automatic router pool and keeps today's behaviour.",
		filterSummary: "All available router models",
	},
	{
		id: "lite",
		label: "Lite",
		tagline: "Fast, lower-cost automation",
		description: "Limits routing to efficient models for quick questions, drafts, and summaries.",
		filterSummary: "Fast models with low token cost",
	},
	{
		id: "standard",
		label: "Standard",
		tagline: "Balanced automation",
		description: "Limits routing to balanced everyday models with solid speed and capability.",
		filterSummary: "Balanced speed, cost, and capability",
	},
	{
		id: "pro",
		label: "Pro",
		tagline: "More capable automation",
		description: "Limits routing to stronger reasoning, analysis, coding, and tool-use models.",
		filterSummary: "Advanced reasoning and tool-use models",
	},
	{
		id: "max",
		label: "Max",
		tagline: "Highest-capability automation",
		description: "Limits routing to the strongest available models for demanding work.",
		filterSummary: "Top complexity, reliability, or intelligence scores",
	},
];

export function doesModelMatchAutoRouterMode(model: ModelConfigItem, mode: ModelRouterMode) {
	if (!isActiveRouterModel(model)) {
		return false;
	}

	return doesModelMatchRouterMode(model, mode);
}

export function countAutoRouterModeCandidates(models: ModelConfigItem[], mode: ModelRouterMode) {
	return models.filter((model) => doesModelMatchAutoRouterMode(model, mode)).length;
}

export function getAutoRouterModeCandidates(models: ModelConfigItem[], mode: ModelRouterMode) {
	return models.filter((model) => doesModelMatchAutoRouterMode(model, mode));
}

export function getAutoRouterModeDefinition(mode: ModelRouterMode) {
	return AUTO_ROUTER_MODES.find((definition) => definition.id === mode) ?? AUTO_ROUTER_MODES[0];
}
