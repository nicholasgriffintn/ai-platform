import z from "zod/v4";

export const createApiKeySchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100).optional(),
});

export const apiKeyParamsSchema = z.object({
  api_key_id: z.string().min(1),
});

export const providerParamsSchema = z.object({
  provider_id: z.string().min(1),
});

export const updateProviderCredentialsSchema = z.object({
  apiKey: z.string(),
  secretKey: z.string().nullable().optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
});
