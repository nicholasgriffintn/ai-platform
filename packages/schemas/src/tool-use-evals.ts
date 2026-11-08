import z from "zod/v4";

import { agentModeSchema } from "./agent-modes.js";
import { recipeConnectorProviderSchema } from "./apps.js";
import { chatModeSchema } from "./chat-modes.js";
import { conversationTypeSchema } from "./conversation-type.js";
import { toolSelectionModeSchema } from "./tools.js";

export const TOOL_USE_EVAL_CASE_KINDS = ["bad", "guard", "control"] as const;

export const toolUseEvalArgsPatternSchema = z
  .record(z.string(), z.unknown())
  .describe(
    'Partial argument match. "~text" matches a case-insensitive substring, "<=N" and ">=N" compare numbers, null requires the key to be absent, and dotted keys reach nested fields.',
  );

export const toolUseEvalCallPatternSchema = z.object({
  tool: z.string().min(1),
  args: toolUseEvalArgsPatternSchema.optional(),
});

export const toolUseEvalRecordedCallSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  result: z.unknown(),
});

export const toolUseEvalHistoryMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string() }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().default(""),
    calls: z.array(toolUseEvalRecordedCallSchema).default([]),
  }),
]);

export const toolUseEvalMockSchema = z.object({
  args: toolUseEvalArgsPatternSchema.optional(),
  result: z.unknown(),
});

export const toolUseEvalRequestSchema = z.object({
  mode: chatModeSchema.optional(),
  toolPolicy: agentModeSchema.optional(),
  toolSelection: toolSelectionModeSchema.default("managed"),
  enabledTools: z.array(z.string()).optional(),
  conversationType: conversationTypeSchema.optional(),
  connectedApps: z.array(recipeConnectorProviderSchema).default([]),
});

export const toolUseEvalSetupSchema = z.object({
  request: toolUseEvalRequestSchema.default({
    toolSelection: "managed",
    connectedApps: [],
  }),
  history: z.array(toolUseEvalHistoryMessageSchema).default([]),
  world: z.record(z.string(), z.unknown()).optional(),
  facts: z.string().optional(),
  mocks: z.record(z.string(), z.array(toolUseEvalMockSchema)).default({}),
});

export const toolUseEvalExpectationSchema = z.object({
  calls: z.array(toolUseEvalCallPatternSchema).optional(),
  callsMustNot: z.array(toolUseEvalCallPatternSchema).optional(),
  order: z.array(toolUseEvalCallPatternSchema).optional(),
  minCalls: z.number().int().nonnegative().optional(),
  maxCalls: z.number().int().nonnegative().optional(),
  textMust: z.array(z.string()).optional(),
  textMustNot: z.array(z.string()).optional(),
  finalTextMust: z.array(z.string()).optional(),
});

export const toolUseEvalCaseSchema = z.object({
  id: z.string().min(1).max(96),
  kind: z.enum(TOOL_USE_EVAL_CASE_KINDS),
  experience: z.string().min(1),
  rule: z.string().min(1),
  source: z.string().min(1),
  setup: toolUseEvalSetupSchema.default({
    request: { toolSelection: "managed", connectedApps: [] },
    history: [],
    mocks: {},
  }),
  prompt: z.string().min(1),
  expect: toolUseEvalExpectationSchema,
});

export const toolUseEvalCallSchema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  result: z.unknown(),
  step: z.number().int().positive(),
  mocked: z.enum(["canned", "environment", "missing"]),
});

export const toolUseEvalTrajectorySchema = z.object({
  calls: z.array(toolUseEvalCallSchema),
  texts: z.array(z.string()),
  finalText: z.string(),
});

export const toolUseEvalSampleRequestSchema = z.object({
  case: toolUseEvalCaseSchema,
  model: z.string().min(1),
  provider: z.string().min(1).optional(),
  maxSteps: z.number().int().min(1).max(16).default(8),
});

export const toolUseEvalSampleSchema = z.object({
  trajectory: toolUseEvalTrajectorySchema,
  stoppedEarly: z.string().nullable(),
  steps: z.number().int().nonnegative(),
  advertisedTools: z.array(z.string()),
  inputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  costUsd: z.number().nonnegative().nullable(),
  durationMs: z.number().nonnegative(),
});

export type ToolUseEvalArgsPattern = z.infer<typeof toolUseEvalArgsPatternSchema>;
export type ToolUseEvalCallPattern = z.infer<typeof toolUseEvalCallPatternSchema>;
export type ToolUseEvalHistoryMessage = z.infer<typeof toolUseEvalHistoryMessageSchema>;
export type ToolUseEvalMock = z.infer<typeof toolUseEvalMockSchema>;
export type ToolUseEvalRequest = z.infer<typeof toolUseEvalRequestSchema>;
export type ToolUseEvalExpectation = z.infer<typeof toolUseEvalExpectationSchema>;
export type ToolUseEvalCase = z.infer<typeof toolUseEvalCaseSchema>;
export type ToolUseEvalCall = z.infer<typeof toolUseEvalCallSchema>;
export type ToolUseEvalTrajectory = z.infer<typeof toolUseEvalTrajectorySchema>;
export type ToolUseEvalSampleRequest = z.infer<typeof toolUseEvalSampleRequestSchema>;
export type ToolUseEvalSample = z.infer<typeof toolUseEvalSampleSchema>;
