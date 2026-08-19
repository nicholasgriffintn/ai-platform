import type { Message } from "~/types";

const SUCCESSFUL_TOOL_STATUSES = new Set(["success", "completed"]);
const FOLLOW_UP_REQUIRED_TOOL_NAMES = new Set(["use_recipe_connector"]);

export interface ToolCallResultReference {
  id?: string;
  name?: string;
  function?: {
    name?: string;
  };
}

function getToolCallName(toolCall: ToolCallResultReference): string | undefined {
  return toolCall.function?.name || toolCall.name;
}

export function isSuccessfulToolStatus(status: string | null | undefined): boolean {
  return SUCCESSFUL_TOOL_STATUSES.has(status || "");
}

export function isContinuableToolResult(message: Message): boolean {
  if (message.status === "pending") {
    return false;
  }

  if (message.name && FOLLOW_UP_REQUIRED_TOOL_NAMES.has(message.name)) {
    return true;
  }

  if (isSuccessfulToolStatus(message.status)) {
    return true;
  }

  if (
    (message.status === "needs_correction" || message.status === "error") &&
    message.data?.recoverable === true
  ) {
    return true;
  }

  return false;
}

export function getFinalToolResultsForCalls(
  toolCalls: ToolCallResultReference[],
  toolResults: Message[],
): Message[] {
  return toolCalls.flatMap((toolCall) => {
    const toolName = getToolCallName(toolCall);
    const result = toolResults
      .slice()
      .reverse()
      .find((message) => message.tool_call_id === toolCall.id && message.name === toolName);

    return result ? [result] : [];
  });
}
