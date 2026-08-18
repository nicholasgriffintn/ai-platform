import z from "zod/v4";

import { modelToolIdSchema } from "./apps";

export const fileSearchToolConfigurationSchema = z.object({
  vectorStoreIds: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
});

export const mcpToolServerConfigurationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: z
    .string()
    .trim()
    .max(2048)
    .pipe(z.url())
    .refine(
      (value) => {
        const url = new URL(value);

        return url.protocol === "https:" && !url.username && !url.password;
      },
      {
        message: "MCP server URLs must use HTTPS without embedded credentials",
      },
    ),
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
