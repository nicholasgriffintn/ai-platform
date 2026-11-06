import { pendingApproval } from "@ngriffin_uk/polychat-library-interactions";
import { canonicalJson, generateId } from "@ngriffin_uk/polychat-utility-core";

import { buildMessageParts } from "~/modules/responses/application/engine/messages/parts";
import type { RunCapPause } from "~/modules/usage/application/run-budget";
import { ToolCallType } from "~/types";
import type { Message, Platform, ToolCall } from "~/types";

const APPROVAL_TOOL_NAME = "request_approval";

export function buildRunCapPauseMessages(
  pause: RunCapPause,
  params: { completionId: string; model: string; platform: Platform },
): { assistant: Message; toolCall: ToolCall; tool: Message } {
  const interactionId = generateId();
  const timestamp = Date.now();
  const toolArguments = { message: pause.message, options: pause.options };
  const toolCall: ToolCall = {
    id: interactionId,
    type: ToolCallType.FUNCTION,
    function: { name: APPROVAL_TOOL_NAME, arguments: canonicalJson(toolArguments) },
  };
  const tool: Message = {
    id: generateId(),
    role: "tool",
    name: APPROVAL_TOOL_NAME,
    content: pause.message,
    status: "pending",
    log_id: "",
    tool_call_id: interactionId,
    tool_call_arguments: toolArguments,
    timestamp,
    model: params.model,
    platform: params.platform,
    data: {
      renderer: "approval_request",
      completion_id: params.completionId,
      message: pause.message,
      options: pause.options,
      timestamp: new Date(timestamp).toISOString(),
      approval: { interactionId, toolName: APPROVAL_TOOL_NAME, reason: pause.message },
      humanInTheLoop: pendingApproval({
        message: pause.message,
        options: pause.options,
        interactionId,
        toolName: APPROVAL_TOOL_NAME,
      }),
      runCap: {
        raiseOption: pause.raiseOption,
        proposedCapCreditMicros: pause.proposedCapCreditMicros,
      },
    },
  };

  return {
    assistant: {
      id: generateId(),
      role: "assistant",
      content: "",
      tool_calls: [toolCall],
      timestamp,
      model: params.model,
      platform: params.platform,
    },
    toolCall,
    tool: { ...tool, parts: buildMessageParts(tool) },
  };
}
