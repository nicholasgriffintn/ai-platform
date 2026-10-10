import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { recipeConnectorProviderSchema } from "./apps.js";
import { delegationContinuationSchema, delegationMemoryBindingSchema } from "./delegations.js";

export const teammateContextScopeSchema = z.object({
  type: z.enum(["personal", "project"]),
  id: z.string().min(1),
});

export const teammateContextStatusSchema = z.enum(["active", "paused", "archived"]);
export type TeammateContextStatus = z.infer<typeof teammateContextStatusSchema>;

export const TEAMMATE_AUTONOMY_LEVELS = ["observer", "assistant", "partner"] as const;

export const teammateAutonomyLevelSchema = z
  .enum(TEAMMATE_AUTONOMY_LEVELS)
  .describe(
    "How much the teammate may do without asking. observer only reads and drafts; assistant asks before writes; partner writes within its grants. Sends, spending, deletes, credentials and exports always ask.",
  );

export type TeammateAutonomyLevel = z.infer<typeof teammateAutonomyLevelSchema>;

export const TEAMMATE_STANDING_APPROVAL_DAYS = 30;

export const STANDING_APPROVAL_OPTION = "Always allow here";

export const teammateStandingApprovalSchema = z.object({
  toolName: z.string().min(1),
  destination: z.string().min(1),
  grantedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

export type TeammateStandingApproval = z.infer<typeof teammateStandingApprovalSchema>;

const teammateStandingApprovalListSchema = z.array(teammateStandingApprovalSchema);

export function parseTeammateStandingApprovals(value: unknown): TeammateStandingApproval[] {
  const candidate: unknown = typeof value === "string" ? safeParseJson(value) : value;
  const parsed = teammateStandingApprovalListSchema.safeParse(candidate);

  return parsed.success ? parsed.data : [];
}

export const TEAMMATE_STANDING_OFFER_STREAK = 5;

export const TEAMMATE_OWNER_ABSENCE_DAYS = 7;

export const teammateApprovalStreakSchema = z.object({
  toolName: z.string().min(1),
  destination: z.string().min(1),
  approvals: z.number().int().positive(),
  lastInteractionId: z.string().min(1),
  lastApprovedAt: z.iso.datetime(),
});

export type TeammateApprovalStreak = z.infer<typeof teammateApprovalStreakSchema>;

const teammateApprovalStreakListSchema = z.array(teammateApprovalStreakSchema);

export function parseTeammateApprovalStreaks(value: unknown): TeammateApprovalStreak[] {
  const candidate: unknown = typeof value === "string" ? safeParseJson(value) : value;
  const parsed = teammateApprovalStreakListSchema.safeParse(candidate);

  return parsed.success ? parsed.data : [];
}

export const teammateContextSchema = z.object({
  id: z.string().min(1),
  teammateId: z.string().min(1),
  actorUserId: z.number().int().positive(),
  scope: teammateContextScopeSchema,
  homeConversationId: z.string().min(1),
  memoryDocumentId: z.string().min(1),
  status: teammateContextStatusSchema,
  autonomyLevel: teammateAutonomyLevelSchema.nullable(),
  standingApprovals: z.array(teammateStandingApprovalSchema),
  approvalStreaks: z.array(teammateApprovalStreakSchema),
  ownerSeenAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const teammateContextListResponseSchema = z.object({
  contexts: z.array(teammateContextSchema),
});

export const ensureTeammateContextSchema = z.object({
  scope: teammateContextScopeSchema,
});

export const updateTeammateContextStatusSchema = z.object({
  status: teammateContextStatusSchema,
});

export const updateTeammateContextAutonomySchema = z.object({
  autonomyLevel: teammateAutonomyLevelSchema,
});

export const teammateConnectionGrantSchema = z.object({
  id: z.string().min(1),
  contextId: z.string().min(1),
  connectionId: z.string().min(1),
  allowedOperations: z.array(z.string().min(1)),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const teammateConnectionGrantListResponseSchema = z.object({
  grants: z.array(teammateConnectionGrantSchema),
  connections: z.array(
    z.object({
      id: z.string().min(1),
      provider: recipeConnectorProviderSchema,
      providerName: z.string().min(1),
      accountId: z.string().nullable(),
      allowedOperations: z.array(z.string().min(1)),
    }),
  ),
});

export const upsertTeammateConnectionGrantSchema = z.object({
  connectionId: z.string().min(1),
  allowedOperations: z.array(z.string().min(1)).max(200),
  expectedRevision: z.number().int().positive().optional(),
});

export const teammateInvocationSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("conversation"),
    conversationId: z.string().min(1),
  }),
  z.object({
    source: z.literal("routine"),
    installationId: z.string().min(1),
    occurrenceId: z.string().min(1),
  }),
  z.object({
    source: z.literal("delegation"),
    delegationId: z.string().min(1),
  }),
  z.object({
    source: z.literal("channel"),
    bindingId: z.string().min(1),
    messageId: z.string().min(1),
    senderMappingId: z.string().min(1),
    senderRevision: z.number().int().positive(),
  }),
  z.object({
    source: z.literal("project_task"),
    taskId: z.string().min(1),
    projectId: z.string().min(1),
  }),
]);

export const teammateRunConfigurationSchema = z
  .object({
    teammateId: z.string().min(1),
    behaviour: z.enum(["colleague", "bot"]),
    invocation: teammateInvocationSchema.optional(),
    persona: z
      .object({
        name: z.string().optional(),
        instructions: z.string().optional(),
        examples: z.array(z.object({ input: z.string(), output: z.string() })).optional(),
      })
      .optional(),
    model: z.string().min(1),
    mode: z.string().min(1),
    skillIds: z.array(z.string().min(1)),
    enabledTools: z.array(z.string().min(1)),
    memoryBindings: z.array(delegationMemoryBindingSchema).default([]),
    delegationContinuation: delegationContinuationSchema.optional(),
    mcpServers: z
      .array(
        z.object({
          label: z.string().min(1),
          url: z.url(),
        }),
      )
      .default([]),
    connectionGrants: z.array(
      z.object({
        id: z.string().min(1),
        connectionId: z.string().min(1),
        revision: z.number().int().positive(),
        allowedOperations: z.array(z.string().min(1)),
      }),
    ),
    maxSteps: z.number().int().positive(),
    usedSteps: z.number().int().nonnegative().default(0),
    maxCreditMicros: z.number().int().nonnegative().optional(),
    deadline: z.iso.datetime().optional(),
  })
  .passthrough();

export type TeammateContext = z.infer<typeof teammateContextSchema>;
export type TeammateContextScope = z.infer<typeof teammateContextScopeSchema>;
export type TeammateConnectionGrant = z.infer<typeof teammateConnectionGrantSchema>;
export type TeammateConnectionGrantListResponse = z.infer<
  typeof teammateConnectionGrantListResponseSchema
>;
export type UpsertTeammateConnectionGrant = z.infer<typeof upsertTeammateConnectionGrantSchema>;
export type TeammateInvocation = z.infer<typeof teammateInvocationSchema>;
export type TeammateRunConfiguration = z.infer<typeof teammateRunConfigurationSchema>;
