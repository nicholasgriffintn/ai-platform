import type { AgentToolCall } from "./types";

export const UPDATE_PLAN_TOOL_NAME = "update_plan";
export const FINISH_TOOL_NAME = "finish";

export const AGENT_CONTROL_TOOL_NAMES = new Set([UPDATE_PLAN_TOOL_NAME, FINISH_TOOL_NAME]);

export function controlToolResultContent(toolCall: Pick<AgentToolCall, "name" | "arguments">) {
  if (toolCall.name !== UPDATE_PLAN_TOOL_NAME) {
    return "Finish request received.";
  }

  const plan = typeof toolCall.arguments.plan === "string" ? toolCall.arguments.plan : "";

  return plan ? `Plan updated.\n\nCurrent plan:\n${plan}` : "Plan updated.";
}
