import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100).optional(),
});

export const deleteApiKeyParamsSchema = z.object({
  keyId: z.string().uuid("Invalid API Key ID format"),
});
