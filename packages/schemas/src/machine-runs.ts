import z from "zod/v4";

import { agentRuntimeVendorSchema, modelRuntimeVendorSchema } from "./desktop-runtimes.js";
import { permissionModeSchema } from "./providers.js";
import { reasoningEffortSchema } from "./reasoning.js";

const machineRunMessagesSchema = z
  .array(
    z
      .object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1).max(100_000),
      })
      .strict(),
  )
  .min(1)
  .max(200);

export type MachineRunMessages = z.infer<typeof machineRunMessagesSchema>;

export const machineModelRunRequestSchema = z
  .object({
    id: z.uuid(),
    vendor: modelRuntimeVendorSchema,
    nativeModelId: z.string().trim().min(1).max(256),
    conversationId: z.string().min(1).max(128),
    messages: machineRunMessagesSchema,
  })
  .strict();

export const machineAgentRunRequestSchema = z
  .object({
    id: z.uuid(),
    kind: z.literal("agent"),
    driver: agentRuntimeVendorSchema,
    conversationId: z.string().min(1).max(128),
    bindingConversationId: z.string().min(1).max(128),
    continuationMode: z.enum(["resume", "fresh"]),
    messages: machineRunMessagesSchema,
    selectedModel: z.string().min(1).nullable(),
    reasoningEffort: reasoningEffortSchema.nullable(),
    permissionMode: permissionModeSchema,
  })
  .strict();

export const DESKTOP_TOOL_NAMES = [
  "list_directory",
  "read_file",
  "search_files",
  "write_file",
] as const;
export const desktopToolNameSchema = z.enum(DESKTOP_TOOL_NAMES);
export type DesktopToolName = z.infer<typeof desktopToolNameSchema>;

const relativePathSchema = z
  .string()
  .trim()
  .max(1024)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.startsWith("\\") &&
      !/^[A-Za-z]:/.test(value) &&
      !value.split(/[\\/]/).some((part) => part === ".."),
    "Paths are relative to the granted folder and may not climb out of it",
  );

export const desktopToolInputSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("list_directory"), path: relativePathSchema.default("") }).strict(),
  z.object({ tool: z.literal("read_file"), path: relativePathSchema.min(1) }).strict(),
  z
    .object({
      tool: z.literal("search_files"),
      query: z.string().trim().min(1).max(200),
      path: relativePathSchema.default(""),
      contents: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      tool: z.literal("write_file"),
      path: relativePathSchema.min(1),
      content: z.string().max(1_000_000),
      overwrite: z.boolean().default(false),
    })
    .strict(),
]);

export type DesktopToolInput = z.infer<typeof desktopToolInputSchema>;

export const desktopLocalToolRequestSchema = z
  .object({
    directoryId: z.string().min(1).max(128),
    input: desktopToolInputSchema,
  })
  .strict();

export type DesktopLocalToolRequest = z.infer<typeof desktopLocalToolRequestSchema>;

export const desktopToolResultSchema = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("list_directory"),
    path: z.string(),
    entries: z.array(
      z.object({
        name: z.string(),
        kind: z.enum(["file", "directory", "other"]),
        size: z.number().int().nonnegative().nullable(),
        modifiedAt: z.string().nullable(),
      }),
    ),
    truncated: z.boolean(),
  }),
  z.object({
    tool: z.literal("read_file"),
    path: z.string(),
    content: z.string(),
    size: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  z.object({
    tool: z.literal("search_files"),
    matches: z.array(
      z.object({
        path: z.string(),
        line: z.number().int().positive().nullable(),
        excerpt: z.string().nullable(),
      }),
    ),
    truncated: z.boolean(),
  }),
  z.object({
    tool: z.literal("write_file"),
    path: z.string(),
    bytes: z.number().int().nonnegative(),
    created: z.boolean(),
  }),
]);

export type DesktopToolResult = z.infer<typeof desktopToolResultSchema>;

export const machineToolRunRequestSchema = z
  .object({
    id: z.uuid(),
    kind: z.literal("tool"),
    conversationId: z.string().min(1).max(128),
    directoryId: z.string().min(1).max(128),
    input: desktopToolInputSchema,
  })
  .strict();

export const machineRunRequestSchema = z
  .union([machineModelRunRequestSchema, machineAgentRunRequestSchema, machineToolRunRequestSchema])
  .refine(
    (request) =>
      !("messages" in request) ||
      request.messages.reduce((size, message) => size + message.content.length, 0) <= 200_000,
    "The conversation is too large for a machine run.",
  );

export const machineRunUpdateSchema = z
  .object({
    id: z.uuid(),
    token: z.uuid(),
    sequence: z.number().int().nonnegative(),
    text: z.string().max(32_000),
    state: z.enum(["running", "completed", "failed"]),
    error: z.string().max(1000).optional(),
  })
  .strict();

export const machineRunSnapshotSchema = z
  .object({
    id: z.uuid(),
    state: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
    text: z.string().max(1_000_000),
    error: z.string().optional(),
  })
  .strict();

export const machineRunClaimSchema = z
  .object({
    request: machineRunRequestSchema,
    token: z.uuid(),
  })
  .strict()
  .nullable();

export type MachineRunRequest = z.infer<typeof machineRunRequestSchema>;
export type MachineToolRunRequest = z.infer<typeof machineToolRunRequestSchema>;
export type MachineRunUpdate = z.infer<typeof machineRunUpdateSchema>;
export type MachineRunSnapshot = z.infer<typeof machineRunSnapshotSchema>;
export type MachineRunClaim = z.infer<typeof machineRunClaimSchema>;
