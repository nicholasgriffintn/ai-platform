import * as z from "zod/v4";

import { petModelOverridesSchema } from "../pets";

export const guardrailsProviderIds = ["llamaguard", "bedrock", "mistral", "shieldstral"] as const;

export const guardrailsProviderSchema = z.enum(guardrailsProviderIds);
export type GuardrailsProviderId = z.infer<typeof guardrailsProviderSchema>;

export const updateUserSettingsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const embeddingProviderSchema = z.enum(["vectorize", "s3vectors"]);
export const s3VectorsBucketNameSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/);
export const s3VectorsIndexNameSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/);
export const awsRegionSchema = z
  .string()
  .trim()
  .max(64)
  .regex(/^[a-z]{2}(?:-[a-z0-9]+)+-\d$/);

export const updateUserSettingsSchema = z
  .object({
    nickname: z.string().nullable().optional(),
    job_role: z.string().nullable().optional(),
    traits: z.string().nullable().optional(),
    preferences: z.string().nullable().optional(),
    tracking_enabled: z.boolean().optional(),
    guardrails_enabled: z.boolean().optional(),
    guardrails_provider: guardrailsProviderSchema.optional(),
    bedrock_guardrail_id: z.string().optional(),
    bedrock_guardrail_version: z.string().optional(),
    embedding_provider: embeddingProviderSchema.optional(),
    bedrock_knowledge_base_id: z.string().optional(),
    bedrock_knowledge_base_custom_data_source_id: z.string().optional(),
    s3vectors_bucket_name: s3VectorsBucketNameSchema.optional(),
    s3vectors_index_name: s3VectorsIndexNameSchema.optional(),
    s3vectors_region: awsRegionSchema.optional(),
    memories_save_enabled: z.boolean().optional(),
    memories_chat_history_enabled: z.boolean().optional(),
    temporary_chats_default: z.boolean().optional(),
    memory_provider: z.enum(["built-in", "hindsight", "honcho"]).optional(),
    transcription_provider: z.string().optional(),
    transcription_model: z.string().optional(),
    speech_provider: z.string().optional(),
    speech_model: z.string().optional(),
    search_provider: z.string().optional(),
    sandbox_model: z.string().optional(),
    pet_source: z.enum(["preset", "custom"]).optional(),
    pet_id: z.string().trim().min(1).max(60).optional(),
    pet_travel_enabled: z.boolean().optional(),
    pet_animation_enabled: z.boolean().optional(),
    pet_model_overrides: petModelOverridesSchema.optional(),
  })
  .superRefine((settings, context) => {
    if (settings.embedding_provider !== "s3vectors") {
      return;
    }

    for (const field of [
      "s3vectors_bucket_name",
      "s3vectors_index_name",
      "s3vectors_region",
    ] as const) {
      if (!settings[field]) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "S3 Vectors configuration is required when selecting this provider",
        });
      }
    }
  });

export const userModelsResponseSchema = z.object({
  success: z.boolean(),
  models: z.array(z.string()),
});

export const providersResponseSchema = z.array(
  z.object({
    id: z.string(),
    provider_id: z.string(),
    enabled: z.boolean(),
    hasApiKey: z.boolean().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    configurationFields: z
      .array(
        z.object({
          key: z.string(),
          label: z.string(),
          type: z.enum(["text", "password"]),
          required: z.boolean().optional(),
          placeholder: z.string().optional(),
          description: z.string().optional(),
        }),
      )
      .optional(),
    configurationValues: z.record(z.string(), z.string()).optional(),
    webhookUrl: z.string().optional(),
  }),
);

export const providerSyncStatusSchema = z.object({
  required: z.boolean(),
  missingProviderIds: z.array(z.string()),
});

export type ProviderSyncStatus = z.infer<typeof providerSyncStatusSchema>;

export const providerSettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  provider_id: z.string().optional(),
  enabled: z.boolean(),
  hasApiKey: z.boolean().optional(),
  apiKey: z.string().optional(),
  secretKey: z.string().optional(),
  baseUrl: z.string().optional(),
  customHeaders: z.record(z.string(), z.string()).optional(),
});
