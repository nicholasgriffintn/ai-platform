import z from "zod/v4";

import { agentModeSchema } from "./agent-modes";
import { skillIdSchema } from "./skills";
import { teammateKindSchema } from "./teammate-roles";
import { toolIdsSchema } from "./tool-ids";

const teammateSkillIdsSchema = z.array(skillIdSchema);

export const mcpServerSchema = z.object({
  url: z.url().meta({
    description: "The endpoint URL of the MCP server",
  }),
  type: z.enum(["sse", "stdio"]).prefault("sse").optional().meta({
    description: "Transport type for MCP connection",
  }),
  command: z.string().optional().meta({
    description: "Optional command for stdio transports",
  }),
  args: z.array(z.string()).optional().meta({
    description: "Arguments for stdio transports",
  }),
});

export const fewShotExampleSchema = z.object({
  input: z.string().meta({ description: "Example input" }),
  output: z.string().meta({ description: "Example output" }),
});

export const createTeammateSchema = z.object({
  name: z.string().meta({ description: "Name of the teammate" }),
  kind: teammateKindSchema.optional().meta({
    description: "Whether this teammate works as a colleague or as a bot",
  }),
  workspace_default: z.boolean().optional().meta({
    description:
      "Whether every project in the owning workspace gets this teammate without being asked",
  }),
  description: z.string().optional().meta({ description: "Optional teammate description" }),
  avatar_url: z.url().nullable().optional().meta({ description: "Optional avatar image URL" }),
  servers: z
    .array(mcpServerSchema)
    .optional()
    .meta({ description: "List of MCP server configurations" }),
  model: z.string().optional().meta({ description: "Model ID to use with this teammate" }),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .nullable()
    .optional()
    .meta({ description: "Temperature override; null uses automatic sampling" }),
  max_steps: z
    .int()
    .positive()
    .optional()
    .meta({ description: "Maximum number of steps for the teammate" }),
  system_prompt: z.string().optional().meta({ description: "System prompt for the teammate" }),
  few_shot_examples: z
    .array(fewShotExampleSchema)
    .optional()
    .meta({ description: "Few-shot examples for the teammate" }),
  enabled_tools: toolIdsSchema.optional().meta({
    description: "Tools enabled by default for this teammate",
  }),
  skill_ids: teammateSkillIdsSchema.optional().meta({
    description: "Skills this teammate loads, named as the skill catalogue names them",
  }),
  mode: agentModeSchema.nullable().optional().meta({
    description: "Teammate mode this teammate runs in; null lets the caller's mode win",
  }),
  workspace_id: z.string().min(1).optional().meta({
    description:
      "Workspace that will own the teammate; omit to create it in the caller's personal scope",
  }),
});

export const updateTeammateSchema = z
  .object({
    name: z.string().optional().meta({ description: "New teammate name" }),
    description: z.string().optional().meta({ description: "New teammate description" }),
    avatar_url: z
      .url()
      .nullable()
      .optional()
      .meta({ description: "New avatar URL, or null to remove the existing one" }),
    servers: z.array(mcpServerSchema).optional().meta({ description: "Updated MCP servers list" }),
    model: z.string().optional().meta({ description: "Model ID to use with this teammate" }),
    temperature: z
      .number()
      .min(0)
      .max(2)
      .nullable()
      .optional()
      .meta({ description: "Temperature override; null restores automatic sampling" }),
    max_steps: z
      .int()
      .positive()
      .optional()
      .meta({ description: "Maximum number of steps for the teammate" }),
    system_prompt: z.string().optional().meta({ description: "System prompt for the teammate" }),
    few_shot_examples: z
      .array(fewShotExampleSchema)
      .optional()
      .meta({ description: "Few-shot examples for the teammate" }),
    enabled_tools: toolIdsSchema.optional().meta({
      description: "Tools enabled by default for this teammate",
    }),
    skill_ids: teammateSkillIdsSchema.optional().meta({
      description: "Updated skills this teammate loads",
    }),
    mode: agentModeSchema.nullable().optional().meta({
      description: "Updated teammate mode; null lets the caller's mode win",
    }),
    kind: teammateKindSchema.optional().meta({
      description: "Updated teammate kind",
    }),
    workspace_default: z.boolean().optional().meta({
      description: "Whether every project in the owning workspace gets this teammate",
    }),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: "At least one field must be provided",
  });

export const teammateOwnerScopeTypeSchema = z.enum(["user", "workspace"]);

export const publishTeammateToWorkspaceSchema = z.object({
  workspace_id: z
    .string()
    .min(1)
    .meta({ description: "Workspace that will own the published copy of the teammate" }),
});

export const teammateResponseSchema = z.object({
  id: z.string(),
  user_id: z.number().int(),
  owner_scope_type: teammateOwnerScopeTypeSchema,
  owner_scope_id: z.string(),
  derived_from_teammate_id: z.string().nullable(),
  kind: teammateKindSchema,
  workspace_default: z.boolean(),
  name: z.string(),
  description: z.string(),
  avatar_url: z.string().nullable(),
  servers: z.array(mcpServerSchema),
  model: z.string().nullable(),
  temperature: z.number().nullable(),
  max_steps: z.number().int().nullable(),
  system_prompt: z.string().nullable(),
  few_shot_examples: z.array(fewShotExampleSchema).nullable(),
  enabled_tools: toolIdsSchema.nullable(),
  skill_ids: teammateSkillIdsSchema,
  mode: agentModeSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const teammateListResponseSchema = z.array(teammateResponseSchema);

export const teammateVerdictSchema = z.enum(["good", "bad"]);

export const teammateScorecardSchema = z.object({
  good: z.number().int().nonnegative(),
  bad: z.number().int().nonnegative(),
});

export const recordTeammateFeedbackSchema = z.object({
  verdict: teammateVerdictSchema,
  conversationId: z.string().min(1).optional(),
  note: z.string().trim().min(1).max(500).optional(),
});

export type TeammateVerdict = z.infer<typeof teammateVerdictSchema>;
export type TeammateScorecard = z.infer<typeof teammateScorecardSchema>;
export type RecordTeammateFeedbackInput = z.infer<typeof recordTeammateFeedbackSchema>;

export const teammateSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: teammateKindSchema,
  description: z.string(),
  avatarUrl: z.string().nullable(),
  model: z.string().nullable(),
  modelAvailable: z.boolean(),
  mode: agentModeSchema.nullable(),
  ownerScopeType: teammateOwnerScopeTypeSchema,
  skillIds: teammateSkillIdsSchema,
  toolIds: toolIdsSchema,
  unavailableSkillIds: teammateSkillIdsSchema,
  unavailableToolIds: toolIdsSchema,
  scorecard: teammateScorecardSchema,
});

export const teammateSummaryListResponseSchema = z.array(teammateSummarySchema);

export type TeammateMcpServer = z.input<typeof mcpServerSchema>;
export type TeammateFewShotExample = z.input<typeof fewShotExampleSchema>;
export type CreateTeammateInput = z.input<typeof createTeammateSchema>;
export type UpdateTeammateInput = z.input<typeof updateTeammateSchema>;
export type PublishTeammateToWorkspaceInput = z.input<typeof publishTeammateToWorkspaceSchema>;
export type TeammateOwnerScopeType = z.infer<typeof teammateOwnerScopeTypeSchema>;
export type TeammateResponse = z.infer<typeof teammateResponseSchema>;
export type TeammateSummary = z.infer<typeof teammateSummarySchema>;
