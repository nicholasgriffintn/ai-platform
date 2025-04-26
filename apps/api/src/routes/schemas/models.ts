import { z } from "zod";
import "zod-openapi/extend";

export const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  description: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  context_length: z.number().optional(),
  pricing: z
    .object({
      prompt: z.number().optional(),
      completion: z.number().optional(),
    })
    .optional(),
  type: z.string().optional(),
});

export const modelsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.record(z.string(), modelSchema),
});

export const modelResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: modelSchema,
});

export const capabilitiesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(z.string()),
});

export const capabilityParamsSchema = z.object({ capability: z.string() });
export const typeParamsSchema = z.object({ type: z.string() });
export const modelParamsSchema = z.object({ id: z.string() });
