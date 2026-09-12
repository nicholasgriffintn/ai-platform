import z from "zod/v4";

import { agentRuntimeVendorSchema, modelRuntimeVendorSchema } from "./desktop-runtimes.js";
import { permissionModeSchema } from "./providers.js";
import { reasoningEffortSchema } from "./reasoning.js";

const machineRunMessagesSchema = z
  .array(
    z
      .object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1).max(100_000),
      })
      .strict(),
  )
  .min(1)
  .max(200);

export const machineModelRunRequestSchema = z
  .object({
    id: z.uuid(),
    vendor: modelRuntimeVendorSchema,
    nativeModelId: z.string().trim().min(1).max(256),
    conversationId: z.string().min(1).max(128),
    messages: machineRunMessagesSchema,
  })
  .strict();

export const machineAgentRunRequestSchema = z
  .object({
    id: z.uuid(),
    kind: z.literal("agent"),
    driver: agentRuntimeVendorSchema,
    conversationId: z.string().min(1).max(128),
    bindingConversationId: z.string().min(1).max(128),
    continuationMode: z.enum(["resume", "fresh"]),
    messages: machineRunMessagesSchema,
    selectedModel: z.string().min(1).nullable(),
    reasoningEffort: reasoningEffortSchema.nullable(),
    permissionMode: permissionModeSchema,
  })
  .strict();

export const machineRunRequestSchema = z
  .union([machineModelRunRequestSchema, machineAgentRunRequestSchema])
  .refine(
    (request) =>
      request.messages.reduce((size, message) => size + message.content.length, 0) <= 200_000,
    "The conversation is too large for a machine run.",
  );

export const machineRunUpdateSchema = z
  .object({
    id: z.uuid(),
    token: z.uuid(),
    sequence: z.number().int().nonnegative(),
    text: z.string().max(32_000),
    state: z.enum(["running", "completed", "failed"]),
    error: z.string().max(1000).optional(),
  })
  .strict();

export const machineRunSnapshotSchema = z
  .object({
    id: z.uuid(),
    state: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
    text: z.string().max(1_000_000),
    error: z.string().optional(),
  })
  .strict();

export const machineRunClaimSchema = z
  .object({
    request: machineRunRequestSchema,
    token: z.uuid(),
  })
  .strict()
  .nullable();

export type MachineRunRequest = z.infer<typeof machineRunRequestSchema>;
export type MachineRunUpdate = z.infer<typeof machineRunUpdateSchema>;
export type MachineRunSnapshot = z.infer<typeof machineRunSnapshotSchema>;
export type MachineRunClaim = z.infer<typeof machineRunClaimSchema>;
