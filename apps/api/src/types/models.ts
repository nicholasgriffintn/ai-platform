import type { availableModalities } from "~/constants/models";
import type { ReasoningEffortLevel, VerbosityLevel } from "./shared";

export type ModelRanking = 1 | 2 | 3 | 4 | 5;

export interface ModelConfigInfo {
	model: string;
	provider: string;
	displayName: string;
}

export type ReplicateInputFieldType =
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "file"
	| "array"
	| "object";

export interface ReplicateInputFieldDescriptor {
	name: string;
	type: ReplicateInputFieldType | ReplicateInputFieldType[];
	description?: string;
	default?: unknown;
	enum?: Array<string | number>;
	required?: boolean;
}

export interface ReplicateInputSchemaDescriptor {
	fields: ReplicateInputFieldDescriptor[];
	reference?: string;
}

export type ModelModality = (typeof availableModalities)[number];

export type ModelModalities = {
	input: ModelModality[];
	output?: ModelModality[];
};

export interface ModelReasoningConfig {
	enabled: boolean;
	supportedEffortLevels?: ReasoningEffortLevel[];
	defaultEffort?: ReasoningEffortLevel;
}

export interface ModelVerbosityConfig {
	supportedVerbosityLevels?: VerbosityLevel[];
	defaultVerbosity?: VerbosityLevel;
}

export type ModelConfigItem = {
	matchingModel: string;
	name?: string;
	description?: string;
	provider: string;
	isBeta?: boolean;
	supportsToolCalls?: boolean;
	isFree?: boolean;
	card?: string;
	contextWindow?: number;
	maxTokens?: number;
	costPer1kInputTokens?: number;
	costPer1kOutputTokens?: number;
	costPer1kReasoningTokens?: number;
	costPer1kSearches?: number;
	costPerRun?: number;
	strengths?: Array<(typeof availableModalities)[number]>;
	contextComplexity?: ModelRanking;
	reliability?: ModelRanking;
	speed?: ModelRanking;
	multimodal?: boolean;
	requiresThinkingPrompt?: boolean;
	includedInRouter?: boolean;
	isFeatured?: boolean;
	hiddenFromDefaultList?: boolean;
	supportsResponseFormat?: boolean;
	supportsArtifacts?: boolean;
	supportsStreaming?: boolean;
	supportsDocuments?: boolean;
	beta?: boolean;
	supportsSearchGrounding?: boolean;
	supportsCodeExecution?: boolean;
	supportsFim?: boolean;
	supportsNextEdit?: boolean;
	supportsApplyEdit?: boolean;
	supportsImageEdits?: boolean;
	timeout?: number;
	supportsAudio?: boolean;
	knowledgeCutoffDate?: string;
	releaseDate?: string;
	lastUpdated?: string;
	modalities: ModelModalities;
	supportsAttachments?: boolean;
	supportsTemperature?: boolean;
	supportsTopP?: boolean;
	supportsTokenCounting?: boolean;
	bedrockApiOperation?: string;
	bedrockStreamingApiOperation?: string;
	supportsPresencePenalty?: boolean;
	restrictsCombinedTopPAndTemperature?: boolean;
	replicateInputSchema?: ReplicateInputSchemaDescriptor;
	supportsPromptCaching?: boolean;
	promptTemplate?: string;
	reasoningConfig?: ModelReasoningConfig;
	verbosityConfig?: ModelVerbosityConfig;
	deprecated?: boolean;
	deprecationMessage?: string;
	replacementModel?: string;
};

export type ModelConfig = {
	[key: string]: ModelConfigItem;
};

export interface PromptRequirements {
	expectedComplexity: ModelRanking;
	requiredStrengths: Array<(typeof availableModalities)[number]>;
	criticalStrengths?: Array<(typeof availableModalities)[number]>;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	hasImages: boolean;
	hasDocuments?: boolean;
	needsFunctions: boolean;
	budget_constraint?: number;
	benefitsFromMultipleModels?: boolean;
	modelComparisonReason?: string;
}
