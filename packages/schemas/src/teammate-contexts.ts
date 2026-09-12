import z from "zod/v4";

import { recipeConnectorProviderSchema } from "./apps";
import { delegationContinuationSchema, delegationMemoryBindingSchema } from "./delegations";

export const teammateContextScopeSchema = z.object({
  type: z.enum(["personal", "project"]),
  id: z.string().min(1),
});

export const teammateContextStatusSchema = z.enum(["active", "paused", "archived"]);
export type TeammateContextStatus = z.infer<typeof teammateContextStatusSchema>;

export const teammateContextSchema = z.object({
  id: z.string().min(1),
  teammateId: z.string().min(1),
  actorUserId: z.number().int().positive(),
  scope: teammateContextScopeSchema,
  homeConversationId: z.string().min(1),
  memoryDocumentId: z.string().min(1),
  status: teammateContextStatusSchema,
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
