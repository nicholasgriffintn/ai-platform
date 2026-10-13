import z from "zod/v4";

import { browserApprovalSchema, browserScreenshotSchema } from "./browser-sessions.js";

export const openAIAgentsSessionResourceSchema = z.object({
  id: z.string().min(1),
  metadata: z.record(z.string(), z.string()).default({}),
  status: z.enum(["idle", "in_progress", "requires_action", "failed"]),
  error: z.string().nullable().optional(),
  required_actions: z.array(z.object({ type: z.string() }).passthrough()).default([]),
});

export const openAIBrowserApprovalSchema = z.object({
  type: z.literal("computer_use_approval_request"),
  request_id: z.string().min(1),
  turn_id: z.string().min(1),
  request: browserApprovalSchema.shape.request,
});

export const openAIAgentsTurnsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      status: z.enum(["queued", "in_progress", "waiting", "completed", "failed", "cancelled"]),
      subagent_id: z.string().nullable(),
      error: z.object({ message: z.string() }).nullable().optional(),
    }),
  ),
});

export const openAIAgentsItemsSchema = z.object({
  data: z.array(z.object({ type: z.string() }).passthrough()),
  has_more: z.boolean(),
  last_id: z.string().nullable(),
});

export const openAIBrowserActivitySchema = z.object({
  type: z.literal("computer_use_call"),
  id: z.string().min(1),
  title: z.string().nullable(),
  status: z.enum(["in_progress", "completed", "failed", "incomplete"]),
  output: z
    .object({ type: z.literal("computer_screenshot"), image_url: browserScreenshotSchema })
    .nullable(),
});

export const openAIAgentsMessageSchema = z.object({
  type: z.literal("message"),
  role: z.enum(["user", "assistant"]),
  phase: z.string().nullable(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

export const openAIAgentsSessionsSchema = z.object({
  data: z.array(openAIAgentsSessionResourceSchema),
  has_more: z.boolean(),
  last_id: z.string().nullable(),
});

export const openAIArtifactSchema = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    turn_id: z.string().min(1),
  })
  .passthrough();
export const openAIArtifactListSchema = z
  .object({ data: z.array(openAIArtifactSchema) })
  .passthrough();
