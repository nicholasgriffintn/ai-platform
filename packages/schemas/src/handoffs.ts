import z from "zod/v4";

import { computeSiteSchema } from "./compute-sites.js";
import { modelTierSchema } from "./model-lineup.js";

export const handoffStateSchema = z.enum([
  "pending",
  "claimed",
  "running",
  "done",
  "declined",
  "expired",
]);

export const handoffRequestedSchema = z
  .object({
    computeSite: computeSiteSchema,
    modelId: z.string().min(1).optional(),
    tier: modelTierSchema.optional(),
    driver: z.string().min(1).optional(),
    directoryId: z.string().min(1).optional(),
    permissionMode: z.string().min(1).optional(),
  })
  .strict();

export const handoffDraftSchema = z
  .object({
    text: z.string().max(100_000),
    attachmentIds: z.array(z.string().min(1)).max(100),
  })
  .strict();

export const handoffSchema = z
  .object({
    id: z.string().min(1),
    conversationId: z.string().min(1),
    target: z.object({ kind: z.literal("machine"), machineId: z.string().min(1) }).strict(),
    requested: handoffRequestedSchema,
    draft: handoffDraftSchema.optional(),
    state: handoffStateSchema,
    claimedBy: z.string().min(1).optional(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();

export const createHandoffRequestSchema = z
  .object({
    conversationId: z.string().trim().min(1).max(128),
    machineId: z.string().trim().min(1).max(128),
    requested: handoffRequestedSchema,
    draft: handoffDraftSchema.optional(),
  })
  .strict();

export const handoffDecisionResponseSchema = z.object({
  handoff: handoffSchema,
});

export type Handoff = z.infer<typeof handoffSchema>;
export type CreateHandoffRequest = z.infer<typeof createHandoffRequestSchema>;
export type HandoffRequested = z.infer<typeof handoffRequestedSchema>;
