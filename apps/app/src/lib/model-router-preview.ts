import type { ModelConfigItem, ModelModality } from "@assistant/schemas";
import {
	getModelDisplayName,
	getModelInputModalities,
	getModelOutputModalities,
	modelSupportsVisualModality,
} from "./models";

export interface RouterPreviewModel {
	id: string;
	name: string;
	provider: string;
	avatarUrl?: string;
}

export interface RouterPreviewLane {
	id: string;
	title: string;
	description: string;
	criteria: string;
	models: RouterPreviewModel[];
	moreModelCount: number;
}

export interface AutomaticRouterPreview {
	candidateCount: number;
	providerCount: number;
	lanes: RouterPreviewLane[];
}

interface RouterLaneDefinition {
	id: string;
	title: string;
	description: string;
	criteria: string;
	matches: (model: ModelConfigItem) => boolean;
	score: (model: ModelConfigItem) => number;
}

const MAX_LANE_MODELS = 3;

function hasStrength(model: ModelConfigItem, strengths: ModelModality[]) {
	return strengths.some((strength) => model.strengths?.includes(strength));
}

function hasInputModality(model: ModelConfigItem, modalities: ModelModality[]) {
	const inputs = getModelInputModalities(model);
	return modalities.some((modality) => inputs.includes(modality));
}

function hasOutputModality(model: ModelConfigItem, modalities: ModelModality[]) {
	const outputs = getModelOutputModalities(model);
	return modalities.some((modality) => outputs.includes(modality));
}

function combinedTokenCost(model: ModelConfigItem) {
	return (model.costPer1kInputTokens ?? 0) + (model.costPer1kOutputTokens ?? 0);
}

function costEfficiencyScore(model: ModelConfigItem) {
	const cost = combinedTokenCost(model);
	if (cost === 0) {
		return 5;
	}
	return Math.max(0, 5 - cost);
}

function capabilityScore(model: ModelConfigItem, strengths: ModelModality[]) {
	return strengths.reduce(
		(score, strength) => score + (model.strengths?.includes(strength) ? 2 : 0),
		0,
	);
}

function buildPreviewModel(model: ModelConfigItem): RouterPreviewModel {
	return {
		id: model.id || model.matchingModel,
		name: getModelDisplayName(model),
		provider: model.provider,
		avatarUrl: model.avatarUrl,
	};
}

function selectLaneModels(models: ModelConfigItem[], lane: RouterLaneDefinition) {
	const matches = models
		.filter(lane.matches)
		.map((model) => ({
			model,
			score: lane.score(model),
		}))
		.sort((a, b) => {
			const scoreDifference = b.score - a.score;
			if (scoreDifference !== 0) {
				return scoreDifference;
			}
			return getModelDisplayName(a.model).localeCompare(getModelDisplayName(b.model));
		});

	return {
		models: matches.slice(0, MAX_LANE_MODELS).map(({ model }) => buildPreviewModel(model)),
		moreModelCount: Math.max(0, matches.length - MAX_LANE_MODELS),
	};
}

const ROUTER_LANES: RouterLaneDefinition[] = [
	{
		id: "fast",
		title: "Fast answers",
		description: "Everyday chat, summaries, and low-friction questions.",
		criteria: "Favours speed, reliability, and low token cost.",
		matches: (model) =>
			hasStrength(model, ["chat", "instruction", "summarization", "general_knowledge"]) ||
			(model.speed ?? 0) >= 4,
		score: (model) =>
			(model.speed ?? 3) * 3 +
			(model.reliability ?? 3) * 2 +
			costEfficiencyScore(model) +
			capabilityScore(model, ["chat", "instruction", "summarization"]),
	},
	{
		id: "reasoning",
		title: "Deep reasoning",
		description: "Hard analysis, maths, planning, and multi-step decisions.",
		criteria: "Favours reasoning strengths and higher context complexity.",
		matches: (model) => hasStrength(model, ["reasoning", "analysis", "math", "academic"]),
		score: (model) =>
			(model.contextComplexity ?? 3) * 3 +
			(model.reliability ?? 3) * 2 +
			capabilityScore(model, ["reasoning", "analysis", "math", "academic"]),
	},
	{
		id: "code",
		title: "Code and tools",
		description: "Implementation work, tool calls, code review, and structured changes.",
		criteria: "Favours coding strengths plus tool or code-execution support.",
		matches: (model) =>
			hasStrength(model, ["coding", "agents"]) ||
			Boolean(model.supportsToolCalls) ||
			Boolean(model.supportsCodeExecution),
		score: (model) =>
			(model.contextComplexity ?? 3) * 2 +
			(model.reliability ?? 3) * 2 +
			(model.supportsToolCalls ? 4 : 0) +
			(model.supportsCodeExecution ? 3 : 0) +
			capabilityScore(model, ["coding", "analysis", "agents"]),
	},
	{
		id: "vision-files",
		title: "Vision and files",
		description: "Screenshots, images, PDFs, and document-heavy prompts.",
		criteria: "Requires visual or document input support.",
		matches: (model) =>
			modelSupportsVisualModality(model) ||
			Boolean(model.supportsDocuments) ||
			hasInputModality(model, ["pdf", "document", "image", "video"]) ||
			hasOutputModality(model, ["image", "video"]),
		score: (model) =>
			(model.contextComplexity ?? 3) * 2 +
			(model.reliability ?? 3) * 2 +
			(modelSupportsVisualModality(model) ? 4 : 0) +
			(model.supportsDocuments ? 4 : 0),
	},
];

export function buildAutomaticRouterPreview(models: ModelConfigItem[]): AutomaticRouterPreview {
	const routerCandidates = models.filter((model) => model.includedInRouter && !model.deprecated);
	const providers = new Set(routerCandidates.map((model) => model.provider));

	return {
		candidateCount: routerCandidates.length,
		providerCount: providers.size,
		lanes: ROUTER_LANES.map((lane) => {
			const selection = selectLaneModels(routerCandidates, lane);

			return {
				id: lane.id,
				title: lane.title,
				description: lane.description,
				criteria: lane.criteria,
				...selection,
			};
		}).filter((lane) => lane.models.length > 0),
	};
}
