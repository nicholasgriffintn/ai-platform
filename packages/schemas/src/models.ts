import z from "zod/v4";

import { readinessSchema } from "./readiness";
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

const modelThinkingApiSchema = z.enum(["adaptive", "budget"]);

const modelReasoningConfigSchema = z.object({
  supportedEffortLevels: z.array(reasoningEffortSchema).optional(),
  defaultEffort: reasoningEffortSchema.optional(),
  modelOverrides: z.partialRecord(reasoningEffortSchema, z.string()).optional(),
  thinkingApi: modelThinkingApiSchema.optional(),
});

const modelVerbosityConfigSchema = z.object({
  supportedVerbosityLevels: z.array(z.enum(["low", "medium", "high", "caveman"])).optional(),
  defaultVerbosity: z.enum(["low", "medium", "high", "caveman"]).optional(),
});

const modelArtificialAnalysisSchema = z.object({
  intelligenceIndex: z.number().optional().nullable(),
  codingIndex: z.number().optional().nullable(),
  agenticIndex: z.number().optional().nullable(),
  intelligenceIndexVersion: z.number().optional().nullable(),
  mediaScores: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.number(),
        min: z.number().optional(),
        max: z.number().optional(),
        lowerIsBetter: z.boolean().optional(),
        confidenceInterval95: z.number().optional().nullable(),
      }),
    )
    .optional(),
});

const modelLongContextPricingSchema = z.object({
  inputTokenThreshold: z.number().int().positive(),
  inputMultiplier: z.number().positive(),
  cachedInputMultiplier: z.number().positive().optional(),
  cacheWriteMultiplier: z.number().positive().optional(),
  outputMultiplier: z.number().positive(),
});

export const modelServiceTierSchema = z.enum(["default", "fast"]);

const modelStatusSchema = z.enum(["alpha", "beta", "deprecated"]);

export const modelConfigItemSchema = z.object({
  id: z.string().optional(),
  matchingModel: z.string(),
  name: z.string().optional(),
  provider: z.string(),
  family: z.string().optional(),
  status: modelStatusSchema.optional(),
  openWeights: z.boolean().optional(),
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
  isFeatured: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isExecutable: z.boolean().optional(),
  readiness: readinessSchema.optional(),
  isPlatformEnabled: z.boolean().optional(),
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
  costPer1kCachedInputTokens: z.number().optional(),
  costPer1kCacheWriteTokens: z.number().optional(),
  costPer1kCacheWrite5mTokens: z.number().optional(),
  costPer1kCacheWrite1hTokens: z.number().optional(),
  costPer1kAudioInputTokens: z.number().optional(),
  costPer1kAudioOutputTokens: z.number().optional(),
  costPer1kImageInputTokens: z.number().optional(),
  costPer1kVideoInputTokens: z.number().optional(),
  costPerCodeExecutionHour: z.number().optional(),
  costPerImage: z.number().optional(),
  costPerVideoSecond: z.number().optional(),
  costPerAudioSecond: z.number().optional(),
  costPerCharacter: z.number().optional(),
  costPerPage: z.number().optional(),
  hostedToolCosts: z.record(z.string(), z.number()).optional(),
  serviceTierMultipliers: z.record(z.string(), z.number()).optional(),
  supportedServiceTiers: z.array(modelServiceTierSchema).optional(),
  longContextPricing: modelLongContextPricingSchema.optional(),
  supportsToolCalls: z.boolean().optional(),
  supportsToolChoice: z.boolean().optional(),
  supportsResponseFormat: z.boolean().optional(),
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
  supportsLogprobs: z.boolean().optional(),
  supportsTopLogprobs: z.boolean().optional(),
  samplingSupportedReasoningEfforts: z.array(reasoningEffortSchema).optional(),
  supportsTokenCounting: z.boolean().optional(),
  supportsRepetitionPenalty: z.boolean().optional(),
  supportsFrequencyPenalty: z.boolean().optional(),
  supportsPresencePenalty: z.boolean().optional(),
  restrictsCombinedTopPAndTemperature: z.boolean().optional(),
  apiOperation: z.string().optional(),
  requiresResponsesApi: z.boolean().optional(),
  prefersResponsesApiForReasoning: z.boolean().optional(),
  bedrockApiOperation: z.string().optional(),
  bedrockStreamingApiOperation: z.string().optional(),
  timeout: z.number().optional(),
  InputSchemaInputSchema: inputSchemaDescriptorSchema.optional(),
  inputSchema: inputSchemaDescriptorSchema.optional(),
  inputFormat: z.enum(["json", "multipart"]).optional(),
  supportsPromptCaching: z.boolean().optional(),
  supportsPromptCacheOptions: z.boolean().optional(),
  supportsAsyncToolCalls: z.boolean().optional(),
  supportsReasoningConfigurationUpdates: z.boolean().optional(),
  promptTemplate: z.string().optional(),
  reasoningConfig: modelReasoningConfigSchema.optional(),
  verbosityConfig: modelVerbosityConfigSchema.optional(),
  artificialAnalysis: modelArtificialAnalysisSchema.optional(),
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

const artificialAnalysisScoresSchema = z.object({
  intelligence: z.number().optional(),
  coding: z.number().optional(),
  agentic: z.number().optional(),
  price: z.number().optional(),
  outputSpeed: z.number().optional(),
  firstTokenLatency: z.number().optional(),
  arenaQuality: z.number().optional(),
  audioQuality: z.number().optional(),
  transcriptionQuality: z.number().optional(),
});

export const artificialAnalysisModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional().nullable(),
  creator_id: z.string().optional().nullable(),
  creator_name: z.string().optional().nullable(),
  creator_slug: z.string().optional().nullable(),
  evaluations: z.record(z.string(), z.unknown()),
  pricing: z.record(z.string(), z.unknown()),
  intelligence_index: z.number().optional().nullable(),
  coding_index: z.number().optional().nullable(),
  agentic_index: z.number().optional().nullable(),
  intelligence_index_version: z.number().optional().nullable(),
  price_1m_blended_3_to_1: z.number().optional().nullable(),
  price_1m_input_tokens: z.number().optional().nullable(),
  price_1m_output_tokens: z.number().optional().nullable(),
  median_output_tokens_per_second: z.number().optional().nullable(),
  median_time_to_first_token_seconds: z.number().optional().nullable(),
  median_time_to_first_answer_token_seconds: z.number().optional().nullable(),
  median_end_to_end_response_time_seconds: z.number().optional().nullable(),
  derived_strengths: z.array(z.string()).optional().nullable(),
  derived_scores: artificialAnalysisScoresSchema.optional().nullable(),
  source: z.literal("artificial_analysis"),
  source_url: z.literal("https://artificialanalysis.ai/"),
  ingested_at: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional().nullable(),
});

export const artificialAnalysisModelsResponseSchema = z.object({
  attribution: z.object({
    label: z.literal("Artificial Analysis"),
    url: z.literal("https://artificialanalysis.ai/"),
  }),
  models: z.array(artificialAnalysisModelSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

export const artificialAnalysisModelsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
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
export type ModelStatus = z.infer<typeof modelStatusSchema>;
export type ModelReasoningConfig = z.infer<typeof modelReasoningConfigSchema>;
export type ModelVerbosityConfig = z.infer<typeof modelVerbosityConfigSchema>;
export type ModelServiceTier = z.infer<typeof modelServiceTierSchema>;
export type ModelConfigItem = z.infer<typeof modelConfigItemSchema>;
export type ModelConfig = Record<string, ModelConfigItem>;
export type ArtificialAnalysisScores = z.infer<typeof artificialAnalysisScoresSchema>;
export type ArtificialAnalysisModel = z.infer<typeof artificialAnalysisModelSchema>;
export type ArtificialAnalysisModelsQuery = z.infer<typeof artificialAnalysisModelsQuerySchema>;
export type InputSchemaInputFieldType = z.infer<typeof inputSchemaFieldTypeSchema>;
export type InputSchemaInputFieldDescriptor = z.infer<typeof inputSchemaFieldDescriptorSchema>;
export type InputSchemaInputSchemaDescriptor = z.infer<typeof inputSchemaDescriptorSchema>;
export type ModelConfigInfo = {
  model: string;
  provider: string;
  displayName: string;
};
export type ModelCatalogItem = ModelConfigItem & {
  id: string;
};
export type ModelCatalogConfig = Record<string, ModelCatalogItem>;
export type PromptRequirements = {
  expectedComplexity: ModelRanking;
  requiredStrengths: ModelModality[];
  criticalStrengths?: ModelModality[];
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  hasImages: boolean;
  hasDocuments?: boolean;
  needsFunctions: boolean;
  budget_constraint?: number;
  benefitsFromMultipleModels?: boolean;
  modelComparisonReason?: string;
};
