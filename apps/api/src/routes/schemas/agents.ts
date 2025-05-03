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
    .min(1, "At least one server is required")
    .openapi({ description: "List of MCP server configurations" }),
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
      .min(1, "At least one server is required")
      .optional()
      .openapi({ description: "Updated MCP servers list" }),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
