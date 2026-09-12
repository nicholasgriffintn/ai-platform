import z from "zod/v4";

import { modelToolIdSchema } from "./apps.js";
import { mcpToolServerConfigurationSchema } from "./mcp.js";

export { mcpToolServerConfigurationSchema } from "./mcp.js";

export const fileSearchToolConfigurationSchema = z.object({
  vectorStoreIds: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
});

export const mcpToolConfigurationSchema = z.object({
  servers: z.array(mcpToolServerConfigurationSchema).min(1).max(10),
});

export const savedToolConfigurationSchema = z.object({
  toolId: modelToolIdSchema,
  configuration: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const savedToolConfigurationsResponseSchema = z.object({
  configurations: z.array(savedToolConfigurationSchema),
});

export const saveToolConfigurationSchema = z.object({
  configuration: z.record(z.string(), z.unknown()),
});

export type FileSearchToolConfiguration = z.infer<typeof fileSearchToolConfigurationSchema>;
export type McpToolConfiguration = z.infer<typeof mcpToolConfigurationSchema>;
export type SavedToolConfiguration = z.infer<typeof savedToolConfigurationSchema>;
export type SavedToolConfigurationsResponse = z.infer<typeof savedToolConfigurationsResponseSchema>;
export type SaveToolConfiguration = z.infer<typeof saveToolConfigurationSchema>;
