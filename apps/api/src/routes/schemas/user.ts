import * as z from "zod";

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
});

export const storeProviderApiKeySchema = z.object({
  providerId: z.string(),
  apiKey: z.string(),
  secretKey: z.string().nullable().optional(),
});
