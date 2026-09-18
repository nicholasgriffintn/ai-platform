import { ToolError, type ToolValidationIssue } from "./errors.js";
import type { AnyToolExecutionContext, ToolDefinition, ToolResult } from "./tool.js";

export function validateToolInput<TInput>(
  tool: Pick<ToolDefinition<TInput, any, any>, "name" | "inputSchema" | "normaliseInput">,
  args: unknown,
): TInput {
  const normalised = tool.normaliseInput?.(args) ?? args;
  const validation = tool.inputSchema.safeParse(normalised);

  if (validation.success) {
    return validation.data;
  }

  const issues: ToolValidationIssue[] = validation.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  const detail = issues.map((issue) => `${issue.path || "(root)"}: ${issue.message}`).join("; ");

  throw new ToolError("invalid_input", `Invalid arguments for ${tool.name}. ${detail}`, {
    toolName: tool.name,
    issues,
  });
}

export async function executeTool<
  TInput,
  TResult extends ToolResult,
  TContext extends AnyToolExecutionContext,
>(
  tool: ToolDefinition<TInput, TResult, TContext>,
  args: unknown,
  context: TContext,
): Promise<TResult> {
  return tool.execute(validateToolInput(tool, args), context);
}
