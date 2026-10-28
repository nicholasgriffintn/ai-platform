import z from "zod/v4";

import type { PermissionMode } from "./providers.js";

export const CLAUDE_CODE_PERMISSION_MODES = {
  supervised: "default",
  auto_accept_edits: "acceptEdits",
  auto: "auto",
  full_access: "bypassPermissions",
} as const satisfies Record<PermissionMode, string>;

export const CLAUDE_CODE_COMMAND_TOOLS = ["Bash"] as const;
export const CLAUDE_CODE_FILE_TOOLS = ["Edit", "MultiEdit", "Write", "NotebookEdit"] as const;

export const claudeCodeModelSchema = z.object({
  value: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  supportedEffortLevels: z.array(z.string()).optional(),
});

export const claudeCodeAccountSchema = z.object({
  email: z.string().optional(),
  subscriptionType: z.string().optional(),
  apiKeySource: z.string().optional(),
  tokenSource: z.string().optional(),
});

export const claudeCodeInitializeResponseSchema = z.object({
  models: z.array(claudeCodeModelSchema).default([]),
  account: claudeCodeAccountSchema.optional(),
});

const claudeCodeUsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
});

const claudeCodeContentBlockSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("thinking"), thinking: z.string().optional() }),
  z.object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    type: z.literal("tool_result"),
    tool_use_id: z.string(),
    content: z.unknown().optional(),
    is_error: z.boolean().optional(),
  }),
  z.object({ type: z.string() }),
]);

export const claudeCodeMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("system"),
    subtype: z.string(),
    session_id: z.string().optional(),
    model: z.string().optional(),
  }),
  z.object({
    type: z.literal("stream_event"),
    parent_tool_use_id: z.string().nullable().optional(),
    event: z.object({
      type: z.string(),
      delta: z
        .object({
          type: z.string(),
          text: z.string().optional(),
          thinking: z.string().optional(),
        })
        .optional(),
    }),
  }),
  z.object({
    type: z.literal("assistant"),
    parent_tool_use_id: z.string().nullable().optional(),
    message: z.object({ content: z.array(claudeCodeContentBlockSchema).default([]) }),
  }),
  z.object({
    type: z.literal("user"),
    parent_tool_use_id: z.string().nullable().optional(),
    message: z.object({ content: z.union([z.string(), z.array(claudeCodeContentBlockSchema)]) }),
  }),
  z.object({
    type: z.literal("result"),
    subtype: z.string(),
    is_error: z.boolean().optional(),
    result: z.string().optional(),
    session_id: z.string().optional(),
    usage: claudeCodeUsageSchema.optional(),
  }),
  z.object({
    type: z.literal("control_request"),
    request_id: z.string(),
    request: z.object({
      subtype: z.string(),
      tool_name: z.string().optional(),
      input: z.record(z.string(), z.unknown()).optional(),
      permission_suggestions: z.array(z.unknown()).optional(),
      title: z.string().optional(),
      display_name: z.string().optional(),
      description: z.string().optional(),
      decision_reason: z.string().optional(),
      blocked_path: z.string().optional(),
      tool_use_id: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("control_response"),
    response: z.object({
      subtype: z.string(),
      request_id: z.string(),
      response: z.unknown().optional(),
      error: z.string().optional(),
    }),
  }),
  z.object({ type: z.literal("control_cancel_request"), request_id: z.string() }),
]);

export type ClaudeCodeMessage = z.infer<typeof claudeCodeMessageSchema>;
export type ClaudeCodeInitializeResponse = z.infer<typeof claudeCodeInitializeResponseSchema>;
export type ClaudeCodeAccount = z.infer<typeof claudeCodeAccountSchema>;
