import z from "zod/v4";

export const CHAT_RETRY_PROTOCOL_VERSION = 1 as const;

export const chatRetryClassificationSchema = z.enum([
  "rate_limited",
  "timeout",
  "network",
  "provider_unavailable",
]);

export const chatRetrySnapshotSchema = z.object({
  protocolVersion: z.literal(CHAT_RETRY_PROTOCOL_VERSION),
  step: z.number().int().positive(),
  attempt: z.number().int().min(2),
  maxAttempts: z.number().int().min(2),
  runRetry: z.number().int().positive(),
  maxRunRetries: z.number().int().positive(),
  phase: z.enum(["waiting", "attempting"]),
  classification: chatRetryClassificationSchema,
  reason: z.string().min(1).max(200),
  scheduledAt: z.string(),
  retryAt: z.string().nullable(),
});

export type ChatRetryClassification = z.infer<typeof chatRetryClassificationSchema>;
export type ChatRetrySnapshot = z.infer<typeof chatRetrySnapshotSchema>;
