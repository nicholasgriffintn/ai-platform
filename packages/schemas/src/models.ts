import z from "zod/v4";

import { reasoningEffortSchema } from "./reasoning";

export const modelModalities = [
	"text",
	"image",
	"audio",
	"video",
	"pdf",
	"document",
	"embedding",
	"moderation",
	"speech",
	"voice-activity-detection",
	"guardrails",
	"reranking",
	"search",
	"creative",
	"instruction",
	"summarization",
	"multilingual",
	"general_knowledge",
	"coding",
	"reasoning",
	"vision",
	"chat",
	"math",
	"analysis",
	"tool_use",
	"academic",
	"research",
	"agents",
	"ocr",
	"transcription",
] as const;

export const modelModalitySchema = z.enum(modelModalities);

const modelRankingSchema = z.union([
	z.literal(1),
	z.literal(2),
	z.literal(3),
	z.literal(4),
	z.literal(5),
]);

const modelModalitiesSchema = z.object({
	input: z.array(modelModalitySchema),
	output: z.array(modelModalitySchema).optional(),
});

const inputSchemaFieldTypeSchema = z.enum([
	"string",
	"number",
	"integer",
	"boolean",
	"file",
	"array",
	"object",
]);

const inputSchemaFieldDescriptorSchema = z.object({
	name: z.string(),
	type: z.union([inputSchemaFieldTypeSchema, z.array(inputSchemaFieldTypeSchema)]),
	description: z.string().optional(),
	default: z.unknown().optional(),
	enum: z.array(z.union([z.string(), z.number()])).optional(),
	required: z.boolean().optional(),
});

const inputSchemaDescriptorSchema = z.object({
	fields: z.array(inputSchemaFieldDescriptorSchema),
	reference: z.string().optional(),
});

const modelReasoningConfigSchema = z.object({
	supportedEffortLevels: z.array(reasoningEffortSchema).optional(),
	defaultEffort: reasoningEffortSchema.optional(),
	modelOverrides: z.record(reasoningEffortSchema, z.string()).optional(),
});

const modelVerbosityConfigSchema = z.object({
	supportedVerbosityLevels: z.array(z.enum(["low", "medium", "high", "caveman"])).optional(),
	defaultVerbosity: z.enum(["low", "medium", "high", "caveman"]).optional(),
});

export const modelConfigItemSchema = z.object({
	id: z.string(),
	matchingModel: z.string(),
	name: z.string().optional(),
	provider: z.string(),
	description: z.string().optional(),
	avatarUrl: z.string().optional(),
	capabilities: z.array(z.string()).optional(),
	context_length: z.number().optional(),
	contextWindow: z.number().optional(),
	maxTokens: z.number().optional(),
	pricing: z
		.object({
			prompt: z.number().optional(),
			completion: z.number().optional(),
		})
		.optional(),
	modalities: modelModalitiesSchema.optional(),
	isBeta: z.boolean().optional(),
	beta: z.boolean().optional(),
	isFree: z.boolean().optional(),
	card: z.string().optional(),
	strengths: z.array(modelModalitySchema).optional(),
	contextComplexity: modelRankingSchema.optional(),
	reliability: modelRankingSchema.optional(),
	speed: modelRankingSchema.optional(),
	multimodal: z.boolean().optional(),
	includedInRouter: z.boolean().optional(),
	isFeatured: z.boolean().optional(),
	isByokEnabled: z.boolean().optional(),
	hiddenFromDefaultList: z.boolean().optional(),
	deprecated: z.boolean().optional(),
	deprecationMessage: z.string().optional(),
	replacementModel: z.string().optional(),
	knowledgeCutoffDate: z.string().optional(),
	releaseDate: z.string().optional(),
	lastUpdated: z.string().optional(),
	costPer1kInputTokens: z.number().optional(),
	costPer1kOutputTokens: z.number().optional(),
	costPer1kReasoningTokens: z.number().optional(),
	costPer1kSearches: z.number().optional(),
	costPerRun: z.number().optional(),
	supportsToolCalls: z.boolean().optional(),
	supportsResponseFormat: z.boolean().optional(),
	supportsArtifacts: z.boolean().optional(),
	supportsStreaming: z.boolean().optional(),
	supportsDocuments: z.boolean().optional(),
	supportsAttachments: z.boolean().optional(),
	supportsSearchGrounding: z.boolean().optional(),
	supportsUrlContext: z.boolean().optional(),
	supportsCodeExecution: z.boolean().optional(),
	supportsFileSearch: z.boolean().optional(),
	supportsMcp: z.boolean().optional(),
	supportsComputerUse: z.boolean().optional(),
	supportsImageGenerationTool: z.boolean().optional(),
	supportsToolSearch: z.boolean().optional(),
	supportsParallelToolCalls: z.boolean().optional(),
	supportsHostedShell: z.boolean().optional(),
	supportsWebFetch: z.boolean().optional(),
	supportsFim: z.boolean().optional(),
	supportsNextEdit: z.boolean().optional(),
	supportsApplyEdit: z.boolean().optional(),
	supportsImageEdits: z.boolean().optional(),
	supportsAudio: z.boolean().optional(),
	supportsRealtimeSession: z.boolean().optional(),
	supportsRealtimeTranslationSession: z.boolean().optional(),
	supportsTemperature: z.boolean().optional(),
	supportsTopP: z.boolean().optional(),
	supportsTokenCounting: z.boolean().optional(),
	supportsRepetitionPenalty: z.boolean().optional(),
	supportsFrequencyPenalty: z.boolean().optional(),
	supportsPresencePenalty: z.boolean().optional(),
	restrictsCombinedTopPAndTemperature: z.boolean().optional(),
	apiOperation: z.string().optional(),
	bedrockApiOperation: z.string().optional(),
	bedrockStreamingApiOperation: z.string().optional(),
	timeout: z.number().optional(),
	InputSchemaInputSchema: inputSchemaDescriptorSchema.optional(),
	inputSchema: inputSchemaDescriptorSchema.optional(),
	supportsPromptCaching: z.boolean().optional(),
	promptTemplate: z.string().optional(),
	reasoningConfig: modelReasoningConfigSchema.optional(),
	verbosityConfig: modelVerbosityConfigSchema.optional(),
});

export const modelSchema = modelConfigItemSchema;

export const modelsResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	data: z.record(z.string(), modelConfigItemSchema),
});

export const modelResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	data: modelConfigItemSchema,
});

export const capabilitiesResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	data: z.array(z.string()),
});

export const capabilityParamsSchema = z.object({ capability: z.string() });
export const modalityParamsSchema = z.object({ modality: modelModalitySchema });
export const modelParamsSchema = z.object({ id: z.string() });

export type ModelRanking = z.infer<typeof modelRankingSchema>;
export type ModelModality = z.infer<typeof modelModalitySchema>;
export type ModelModalities = z.infer<typeof modelModalitiesSchema>;
export type ModelReasoningConfig = z.infer<typeof modelReasoningConfigSchema>;
export type ModelVerbosityConfig = z.infer<typeof modelVerbosityConfigSchema>;
export type ModelConfigItem = z.infer<typeof modelConfigItemSchema>;
export type ModelConfig = Record<string, ModelConfigItem>;
