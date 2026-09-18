import z from "zod/v4";

import { declareTool, type ToolDeclaration } from "./declaration.js";
import { flattenObjectRootSchema } from "./json-schema.js";

export interface ToolResult {
  status?: string;
  name?: string;
  content?: string | Record<string, unknown> | unknown[];
  data?: unknown;
  [key: string]: unknown;
}

interface ToolExecutionContextBase<TEnv, TUser, TConversationManager, TToolResult> {
  completionId: string;
  toolCallId?: string;
  env: TEnv;
  user?: TUser;
  conversationManager?: TConversationManager;
  abortSignal?: AbortSignal;
  appUrl?: string;
  emitToolResult?: (result: TToolResult) => Promise<void> | void;
}

export type ToolExecutionContext<
  TEnv = unknown,
  TUser = unknown,
  TConversationManager = unknown,
  TRequest = unknown,
  TToolResult extends ToolResult = ToolResult,
> = ToolExecutionContextBase<TEnv, TUser, TConversationManager, TToolResult> &
  (undefined extends TRequest ? { request?: TRequest } : { request: TRequest });

export type AnyToolExecutionContext = ToolExecutionContext<unknown, unknown, unknown, unknown, any>;

export type ToolType = "normal" | "premium" | "byok";

export interface ToolDefinition<
  TInput = unknown,
  TResult extends ToolResult = ToolResult,
  TContext extends AnyToolExecutionContext = ToolExecutionContext,
> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput, context: TContext) => Promise<TResult>;
  type: ToolType;
  strict?: boolean;
  isDefault?: boolean;
  app_url?: string;
  permissions?: string[];
  normaliseInput?: (input: unknown) => unknown;
  maxIdenticalCalls?: number;
  companionTools?: readonly string[];
}

export type ToolDescriptor<
  TInput = unknown,
  TResult extends ToolResult = ToolResult,
  TContext extends AnyToolExecutionContext = ToolExecutionContext,
> = Omit<ToolDefinition<TInput, TResult, TContext>, "execute" | "normaliseInput">;

export function defineTool<
  TInput,
  TResult extends ToolResult,
  TContext extends AnyToolExecutionContext = ToolExecutionContext,
>(
  definition: ToolDefinition<TInput, TResult, TContext>,
): ToolDefinition<TInput, TResult, TContext> {
  return definition;
}

export function toToolDeclaration(
  tool: Pick<ToolDescriptor, "name" | "description" | "inputSchema">,
): ToolDeclaration {
  const { $schema: _schema, ...schema } = z.toJSONSchema(tool.inputSchema, { io: "input" });

  return declareTool({
    name: tool.name,
    description: tool.description,
    schema: flattenObjectRootSchema(schema),
  });
}
