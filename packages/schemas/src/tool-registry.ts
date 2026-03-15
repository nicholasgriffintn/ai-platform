import type z from "zod/v4";

export interface ToolExecutionContext<
	TEnv = unknown,
	TUser = unknown,
	TConversationManager = unknown,
> {
	completionId: string;
	env: TEnv;
	user?: TUser;
	conversationManager?: TConversationManager;
	abortSignal?: AbortSignal;
	request?: unknown;
	appUrl?: string;
}

export interface ToolResult {
	status?: string;
	name?: string;
	content?: string | Record<string, unknown> | unknown[];
	data?: unknown;
	[key: string]: unknown;
}

export interface ToolDefinition<
	TInput = unknown,
	TResult extends ToolResult = ToolResult,
	TContext extends ToolExecutionContext = ToolExecutionContext,
> {
	name: string;
	description: string;
	inputSchema: z.ZodType<TInput>;
	execute: (input: TInput, context: TContext) => Promise<TResult>;
	type: "normal" | "premium";
	costPerCall: number;
	strict?: boolean;
	isDefault?: boolean;
	app_url?: string;
	permissions?: string[];
}
