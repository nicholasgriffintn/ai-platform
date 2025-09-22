import z from "zod/v4";

export const createApiKeySchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100).optional(),
});

export const deleteApiKeyParamsSchema = z.object({
  keyId: z.uuid(),
});

export const storeProviderApiKeySchema = z.object({
  providerId: z.string(),
  apiKey: z.string(),
  secretKey: z.string().nullable().optional(),
});
