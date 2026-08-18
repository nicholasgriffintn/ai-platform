import type { Message } from "~/types";

const SUCCESSFUL_TOOL_STATUSES = new Set(["success", "completed"]);
const FOLLOW_UP_REQUIRED_TOOL_NAMES = new Set(["use_recipe_connector"]);
const CAPABILITY_DISCOVERY_TOOL_NAME = "discover_capabilities";
const CAPABILITY_DISCOVERY_MAX_STEPS = 4;

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

function isContinuableToolResult(message: Message): boolean {
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

export function shouldContinueAfterToolResults(
  toolCalls: ToolCallResultReference[],
  toolResults: Message[],
): boolean {
  if (toolCalls.length === 0) {
    return false;
  }

  const finalResults = getFinalToolResultsForCalls(toolCalls, toolResults);

  return (
    finalResults.length === toolCalls.length &&
    finalResults.every((message) => isContinuableToolResult(message))
  );
}

export function resolveToolStepBudget(
  configuredMaxSteps: number | undefined,
  toolCalls: ToolCallResultReference[],
  toolResults: Message[],
): number | undefined {
  if (typeof configuredMaxSteps === "number") {
    return configuredMaxSteps;
  }

  const completedDiscovery = getFinalToolResultsForCalls(toolCalls, toolResults).some(
    (message) =>
      message.name === CAPABILITY_DISCOVERY_TOOL_NAME && isSuccessfulToolStatus(message.status),
  );

  return completedDiscovery ? CAPABILITY_DISCOVERY_MAX_STEPS : undefined;
}
