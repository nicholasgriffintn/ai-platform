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

export function capTeammateAutonomyLevel(
  level: TeammateAutonomyLevel | null,
  ceiling: TeammateAutonomyLevel | undefined,
): TeammateAutonomyLevel | null {
  if (!ceiling) {
    return level;
  }

  if (level === null) {
    return ceiling;
  }

  return TEAMMATE_AUTONOMY_LEVELS.indexOf(level) > TEAMMATE_AUTONOMY_LEVELS.indexOf(ceiling)
    ? ceiling
    : level;
}

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

export const TEAMMATE_TOOL_RULE_LEVELS = ["act", "act_if_asked", "ask", "hand_off"] as const;

export const teammateToolRuleLevelSchema = z
  .enum(TEAMMATE_TOOL_RULE_LEVELS)
  .describe(
    "act runs without asking; act_if_asked runs without asking only on turns the owner started; ask always asks first; hand_off never runs and leaves the step to the owner. Sends, spending, deletes, credentials and exports still ask.",
  );

export type TeammateToolRuleLevel = z.infer<typeof teammateToolRuleLevelSchema>;

export const TEAMMATE_TOOL_RULE_LIMIT = 100;

export const teammateToolRuleSchema = z.object({
  toolName: z.string().trim().min(1).max(200),
  level: teammateToolRuleLevelSchema,
});

export type TeammateToolRule = z.infer<typeof teammateToolRuleSchema>;

export const teammateToolRulesSchema = z
  .array(teammateToolRuleSchema)
  .max(TEAMMATE_TOOL_RULE_LIMIT)
  .refine(
    (rules) => new Set(rules.map((rule) => rule.toolName)).size === rules.length,
    "Each tool may have one rule",
  );

export function parseTeammateToolRules(value: unknown): TeammateToolRule[] {
  const candidate: unknown = typeof value === "string" ? safeParseJson(value) : value;
  const parsed = teammateToolRulesSchema.safeParse(candidate);

  return parsed.success ? parsed.data : [];
}

export function findTeammateToolRule(
  rules: readonly TeammateToolRule[] | undefined,
  toolName: string,
): TeammateToolRuleLevel | null {
  const target = toolName.trim().toLowerCase();

  return rules?.find((rule) => rule.toolName.trim().toLowerCase() === target)?.level ?? null;
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
  toolRules: z.array(teammateToolRuleSchema),
  pausedUntil: z.string().nullable(),
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

export const updateTeammateContextToolRulesSchema = z.object({
  toolRules: teammateToolRulesSchema,
});

export const TEAMMATE_PAUSE_MAX_HOURS = 24 * 7;

export const updateTeammateContextPauseSchema = z.object({
  pausedUntil: z.iso
    .datetime()
    .nullable()
    .describe("When the pause ends, at most a week ahead, or null to resume now"),
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

export const teammateConnectionOperationSchema = z.object({
  id: z.string().min(1),
  access: z.enum(["read", "write"]),
  destructive: z.boolean(),
  important: z.boolean(),
});

export const teammateConnectionGrantListResponseSchema = z.object({
  grants: z.array(teammateConnectionGrantSchema),
  connections: z.array(
    z.object({
      id: z.string().min(1),
      provider: recipeConnectorProviderSchema,
      providerName: z.string().min(1),
      accountId: z.string().nullable(),
      operations: z.array(teammateConnectionOperationSchema),
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
    threadId: z.string().min(1).max(998).optional(),
    subject: z.string().max(998).optional(),
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
export type TeammateConnectionOperation = z.infer<typeof teammateConnectionOperationSchema>;
export type TeammateConnectionGrantListResponse = z.infer<
  typeof teammateConnectionGrantListResponseSchema
>;
export type UpsertTeammateConnectionGrant = z.infer<typeof upsertTeammateConnectionGrantSchema>;
export type TeammateInvocation = z.infer<typeof teammateInvocationSchema>;
export type TeammateRunConfiguration = z.infer<typeof teammateRunConfigurationSchema>;
