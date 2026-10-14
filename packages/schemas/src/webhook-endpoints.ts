import z from "zod/v4";

import { listSchema } from "./platform/list.js";

export const WEBHOOK_EVENT_TYPES = [
  "response.completed",
  "response.failed",
  "response.cancelled",
  "response.incomplete",
  "response.waiting",
] as const;

export const WEBHOOK_TEST_EVENT_TYPE = "webhook.test";
export const WEBHOOK_SIGNATURE_HEADER = "Polychat-Signature";
export const WEBHOOK_EVENT_ID_HEADER = "Polychat-Event-Id";

export const webhookEventTypeSchema = z.enum(WEBHOOK_EVENT_TYPES);
export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;

const webhookUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => value.startsWith("https://"), "Webhook endpoints must use HTTPS");

export const webhookEndpointSchema = z.object({
  object: z.literal("webhook_endpoint"),
  id: z.string().min(1),
  url: z.string(),
  description: z.string(),
  events: z.array(webhookEventTypeSchema),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type WebhookEndpoint = z.infer<typeof webhookEndpointSchema>;

export const webhookEndpointWithSecretSchema = webhookEndpointSchema.extend({
  secret: z.string().min(1),
});
export type WebhookEndpointWithSecret = z.infer<typeof webhookEndpointWithSecretSchema>;

export const webhookEndpointListSchema = listSchema(webhookEndpointSchema);

export const createWebhookEndpointSchema = z.object({
  url: webhookUrlSchema,
  description: z.string().trim().max(200).default(""),
  events: z.array(webhookEventTypeSchema).min(1).max(WEBHOOK_EVENT_TYPES.length),
});
export type CreateWebhookEndpointInput = z.infer<typeof createWebhookEndpointSchema>;

export const updateWebhookEndpointSchema = z
  .object({
    url: webhookUrlSchema,
    description: z.string().trim().max(200),
    events: z.array(webhookEventTypeSchema).min(1).max(WEBHOOK_EVENT_TYPES.length),
    enabled: z.boolean(),
  })
  .partial();
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>;

export const webhookEndpointParamsSchema = z.object({ webhook_endpoint_id: z.string().min(1) });

export const webhookEventSchema = z.object({
  object: z.literal("event"),
  id: z.string().min(1),
  type: z.union([webhookEventTypeSchema, z.literal(WEBHOOK_TEST_EVENT_TYPE)]),
  created_at: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export const webhookTestResultSchema = z.object({
  delivered: z.boolean(),
  status: z.number().int().nullable(),
});
export type WebhookTestResult = z.infer<typeof webhookTestResultSchema>;
