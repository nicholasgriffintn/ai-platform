import {
  AGENT_CONTROL_TOOL_NAMES,
  FINISH_TOOL_NAME,
  UPDATE_PLAN_TOOL_NAME,
} from "@ngriffin_uk/polychat-library-tools";

import type { AgentToolCall } from "./types.js";

export { AGENT_CONTROL_TOOL_NAMES, FINISH_TOOL_NAME, UPDATE_PLAN_TOOL_NAME };

export function controlToolResultContent(toolCall: Pick<AgentToolCall, "name" | "arguments">) {
  if (toolCall.name !== UPDATE_PLAN_TOOL_NAME) {
    return "Finish request received.";
  }

  const plan = typeof toolCall.arguments.plan === "string" ? toolCall.arguments.plan : "";

  return plan ? `Plan updated.\n\nCurrent plan:\n${plan}` : "Plan updated.";
}
