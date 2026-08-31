import z from "zod/v4";

import { agentModeSchema } from "./agent-modes";
import { skillIdSchema } from "./skills";
import { toolIdsSchema } from "./tool-ids";

const agentSkillIdsSchema = z.array(skillIdSchema);

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

export const createAgentSchema = z.object({
  name: z.string().meta({ description: "Name of the agent" }),
  description: z.string().optional().meta({ description: "Optional agent description" }),
  avatar_url: z.url().nullable().optional().meta({ description: "Optional avatar image URL" }),
  servers: z
    .array(mcpServerSchema)
    .optional()
    .meta({ description: "List of MCP server configurations" }),
  model: z.string().optional().meta({ description: "Model ID to use with this agent" }),
  temperature: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .meta({ description: "Temperature setting for the model" }),
  max_steps: z
    .int()
    .positive()
    .optional()
    .meta({ description: "Maximum number of steps for the agent" }),
  system_prompt: z.string().optional().meta({ description: "System prompt for the agent" }),
  few_shot_examples: z
    .array(fewShotExampleSchema)
    .optional()
    .meta({ description: "Few-shot examples for the agent" }),
  enabled_tools: toolIdsSchema.optional().meta({
    description: "Tools enabled by default for this agent",
  }),
  skill_ids: agentSkillIdsSchema.optional().meta({
    description: "Skills this agent loads, named as the skill catalogue names them",
  }),
  mode: agentModeSchema.nullable().optional().meta({
    description: "Agent mode this agent runs in; null lets the caller's mode win",
  }),
  team_id: z.string().optional().meta({ description: "Team ID this agent belongs to" }),
  team_role: z.string().optional().meta({ description: "Role of this agent within the team" }),
  is_team_agent: z
    .boolean()
    .optional()
    .prefault(false)
    .meta({ description: "Whether this is a team agent" }),
});

export const updateAgentSchema = z
  .object({
    name: z.string().optional().meta({ description: "New agent name" }),
    description: z.string().optional().meta({ description: "New agent description" }),
    avatar_url: z.url().optional().meta({ description: "New avatar URL" }).optional(),
    servers: z.array(mcpServerSchema).optional().meta({ description: "Updated MCP servers list" }),
    model: z.string().optional().meta({ description: "Model ID to use with this agent" }),
    temperature: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .meta({ description: "Temperature setting for the model" }),
    max_steps: z
      .int()
      .positive()
      .optional()
      .meta({ description: "Maximum number of steps for the agent" }),
    system_prompt: z.string().optional().meta({ description: "System prompt for the agent" }),
    few_shot_examples: z
      .array(fewShotExampleSchema)
      .optional()
      .meta({ description: "Few-shot examples for the agent" }),
    enabled_tools: toolIdsSchema.optional().meta({
      description: "Tools enabled by default for this agent",
    }),
    skill_ids: agentSkillIdsSchema.optional().meta({
      description: "Updated skills this agent loads",
    }),
    mode: agentModeSchema.nullable().optional().meta({
      description: "Updated agent mode; null lets the caller's mode win",
    }),
    team_id: z.string().optional().meta({ description: "Team ID this agent belongs to" }),
    team_role: z.string().optional().meta({ description: "Role of this agent within the team" }),
    is_team_agent: z.boolean().optional().meta({ description: "Whether this is a team agent" }),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: "At least one field must be provided",
  });

export const agentOwnerScopeTypeSchema = z.enum(["user", "workspace"]);

export const publishAgentToWorkspaceSchema = z.object({
  workspace_id: z
    .string()
    .min(1)
    .meta({ description: "Workspace that will own the published copy of the agent" }),
});

export const agentResponseSchema = z.object({
  id: z.string(),
  user_id: z.number().int(),
  owner_scope_type: agentOwnerScopeTypeSchema,
  owner_scope_id: z.string(),
  derived_from_agent_id: z.string().nullable(),
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
  skill_ids: agentSkillIdsSchema,
  mode: agentModeSchema.nullable(),
  team_id: z.string().nullable(),
  team_role: z.string().nullable(),
  is_team_agent: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const agentListResponseSchema = z.array(agentResponseSchema);

export const agentSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  avatarUrl: z.string().nullable(),
  model: z.string().nullable(),
  modelAvailable: z.boolean(),
  mode: agentModeSchema.nullable(),
  ownerScopeType: agentOwnerScopeTypeSchema,
  skillIds: agentSkillIdsSchema,
  toolIds: toolIdsSchema,
  unavailableSkillIds: agentSkillIdsSchema,
  unavailableToolIds: toolIdsSchema,
});

export const agentSummaryListResponseSchema = z.array(agentSummarySchema);

export type AgentMcpServer = z.input<typeof mcpServerSchema>;
export type AgentFewShotExample = z.input<typeof fewShotExampleSchema>;
export type CreateAgentInput = z.input<typeof createAgentSchema>;
export type UpdateAgentInput = z.input<typeof updateAgentSchema>;
export type PublishAgentToWorkspaceInput = z.input<typeof publishAgentToWorkspaceSchema>;
export type AgentOwnerScopeType = z.infer<typeof agentOwnerScopeTypeSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type AgentSummary = z.infer<typeof agentSummarySchema>;
