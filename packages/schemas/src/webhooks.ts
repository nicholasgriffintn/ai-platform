import z from "zod/v4";

export const replicateWebhookQuerySchema = z.object({
  completion_id: z.string().min(1, "completion_id is required"),
  token: z.string().min(1, "token is required"),
});

export const replicateWebhookJsonSchema = z.object({
  id: z
    .string()
    .min(1, "id is required")
    .meta({ example: "ufawqhfynnddngldkgtslldrkq" }),
  version: z.string().optional().meta({
    example: "5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa",
  }),
  created_at: z
    .string()
    .optional()
    .meta({ example: "2024-01-01T00:00:00.000Z" }),
  started_at: z.string().optional().nullable().meta({ example: null }),
  completed_at: z.string().optional().nullable().meta({ example: null }),
  status: z.string().optional().meta({ example: "starting" }),
  input: z
    .object({
      prompt: z.string().optional().meta({ example: "Alice" }),
      guidance_scale: z.number().optional().meta({ example: 7 }),
    })
    .optional(),
  output: z.array(z.string()).optional().nullable(),
  error: z.string().optional().nullable(),
  logs: z.string().optional().nullable(),
  metrics: z
    .object({
      predict_time: z.number().optional().nullable(),
      total_time: z.number().optional().nullable(),
    })
    .optional()
    .nullable(),
  urls: z.object({
    stream: z.string().optional().nullable(),
    get: z.string().optional().nullable(),
    cancel: z.string().optional().nullable(),
    version: z.string().optional().nullable(),
  }),
});

export const webhookResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  message: z.string(),
});
