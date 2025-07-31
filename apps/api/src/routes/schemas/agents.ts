import { z } from "zod";
import "zod-openapi/extend";

export const mcpServerSchema = z.object({
  url: z.string().url().openapi({
    description: "The endpoint URL of the MCP server",
  }),
  type: z.enum(["sse", "stdio"]).default("sse").optional().openapi({
    description: "Transport type for MCP connection",
  }),
  command: z.string().optional().openapi({
    description: "Optional command for stdio transports",
  }),
  args: z.array(z.string()).optional().openapi({
    description: "Arguments for stdio transports",
  }),
  env: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .optional()
    .openapi({ description: "Environment variables for the MCP process" }),
  headers: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .optional()
    .openapi({ description: "HTTP headers for SSE transports" }),
});

export const fewShotExampleSchema = z.object({
  input: z.string().openapi({ description: "Example input" }),
  output: z.string().openapi({ description: "Example output" }),
});

export const createAgentSchema = z.object({
  name: z.string().openapi({ description: "Name of the agent" }),
  description: z
    .string()
    .optional()
    .openapi({ description: "Optional agent description" }),
  avatar_url: z
    .string()
    .url()
    .nullable()
    .optional()
    .openapi({ description: "Optional avatar image URL" }),
  servers: z
    .array(mcpServerSchema)
    .optional()
    .openapi({ description: "List of MCP server configurations" }),
  model: z
    .string()
    .optional()
    .openapi({ description: "Model ID to use with this agent" }),
  temperature: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .openapi({ description: "Temperature setting for the model" }),
  max_steps: z
    .number()
    .int()
    .positive()
    .optional()
    .openapi({ description: "Maximum number of steps for the agent" }),
  system_prompt: z
    .string()
    .optional()
    .openapi({ description: "System prompt for the agent" }),
  few_shot_examples: z
    .array(fewShotExampleSchema)
    .optional()
    .openapi({ description: "Few-shot examples for the agent" }),
  team_id: z
    .string()
    .optional()
    .openapi({ description: "Team ID this agent belongs to" }),
  team_role: z
    .string()
    .optional()
    .openapi({ description: "Role of this agent within the team" }),
  is_team_agent: z
    .boolean()
    .optional()
    .default(false)
    .openapi({ description: "Whether this is a team agent" }),
});

export const updateAgentSchema = z
  .object({
    name: z.string().optional().openapi({ description: "New agent name" }),
    description: z
      .string()
      .optional()
      .openapi({ description: "New agent description" }),
    avatar_url: z
      .string()
      .url()
      .optional()
      .openapi({ description: "New avatar URL" })
      .optional(),
    servers: z
      .array(mcpServerSchema)
      .optional()
      .openapi({ description: "Updated MCP servers list" }),
    model: z
      .string()
      .optional()
      .openapi({ description: "Model ID to use with this agent" }),
    temperature: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .openapi({ description: "Temperature setting for the model" }),
    max_steps: z
      .number()
      .int()
      .positive()
      .optional()
      .openapi({ description: "Maximum number of steps for the agent" }),
    system_prompt: z
      .string()
      .optional()
      .openapi({ description: "System prompt for the agent" }),
    few_shot_examples: z
      .array(fewShotExampleSchema)
      .optional()
      .openapi({ description: "Few-shot examples for the agent" }),
    team_id: z
      .string()
      .optional()
      .openapi({ description: "Team ID this agent belongs to" }),
    team_role: z
      .string()
      .optional()
      .openapi({ description: "Role of this agent within the team" }),
    is_team_agent: z
      .boolean()
      .optional()
      .openapi({ description: "Whether this is a team agent" }),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
