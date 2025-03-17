import type { availableCapabilities, availableModelTypes } from "../lib/models";

export type ModelRanking = 1 | 2 | 3 | 4 | 5;

export type ModelConfigItem = {
	matchingModel: string;
	name?: string;
	description?: string;
	provider: string;
	type: Array<(typeof availableModelTypes)[number]>;
	isBeta?: boolean;
	supportsFunctions?: boolean;
	isFree?: boolean;
	card?: string;
	contextWindow?: number;
	maxTokens?: number;
	costPer1kInputTokens?: number;
	costPer1kOutputTokens?: number;
	costPer1kReasoningTokens?: number;
	costPer1kSearches?: number;
	strengths?: Array<(typeof availableCapabilities)[number]>;
	contextComplexity?: ModelRanking;
	reliability?: ModelRanking;
	speed?: ModelRanking;
	multimodal?: boolean;
	hasThinking?: boolean;
	includedInRouter?: boolean;
	isFeatured?: boolean;
	supportsResponseFormat?: boolean;
};

export type ModelConfig = {
	[key: string]: ModelConfigItem;
};

export interface PromptRequirements {
	expectedComplexity: ModelRanking;
	requiredCapabilities: Array<(typeof availableCapabilities)[number]>;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	hasImages: boolean;
	needsFunctions: boolean;
	budget_constraint?: number;
}
