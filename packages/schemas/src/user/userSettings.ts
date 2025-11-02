import * as z from "zod/v4";

export const updateUserSettingsResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
});

export const updateUserSettingsSchema = z.object({
	nickname: z.string().nullable().optional(),
	job_role: z.string().nullable().optional(),
	traits: z.string().nullable().optional(),
	preferences: z.string().nullable().optional(),
	tracking_enabled: z.boolean().optional(),
	guardrails_enabled: z.boolean().optional(),
	guardrails_provider: z.string().optional(),
	bedrock_guardrail_id: z.string().optional(),
	bedrock_guardrail_version: z.string().optional(),
	embedding_provider: z.string().optional(),
	bedrock_knowledge_base_id: z.string().optional(),
	bedrock_knowledge_base_custom_data_source_id: z.string().optional(),
	s3vectors_bucket_name: z.string().optional(),
	s3vectors_index_name: z.string().optional(),
	s3vectors_region: z.string().optional(),
	memories_save_enabled: z.boolean().optional(),
	memories_chat_history_enabled: z.boolean().optional(),
	transcription_provider: z.string().optional(),
	transcription_model: z.string().optional(),
	search_provider: z.string().optional(),
});

export const userModelsResponseSchema = z.object({
	success: z.boolean(),
	models: z.array(z.string()),
});

export const providersResponseSchema = z.object({
	success: z.boolean(),
	providers: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			type: z.string(),
			enabled: z.boolean(),
			hasApiKey: z.boolean().optional(),
		}),
	),
});

export const providerSettingsSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	enabled: z.boolean(),
	hasApiKey: z.boolean().optional(),
	apiKey: z.string().optional(),
	secretKey: z.string().optional(),
	baseUrl: z.string().optional(),
	customHeaders: z.record(z.string(), z.string()).optional(),
});
