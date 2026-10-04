import { pendingApproval } from "@ngriffin_uk/polychat-library-interactions";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { formatToolErrorResponse } from "~/modules/chat/application/tools/tool-responses";
import type { Message, Platform } from "~/types";

export interface ToolApprovalDecisionTag {
  key: string;
  version: string;
  recommended: string;
}

export function createPendingToolApprovalMessage(params: {
  toolName: string;
  toolCallId: string;
  toolCallArguments: unknown;
  reason: string;
  logId: string;
  timestamp: number;
  model: string;
  platform: Platform;
  decision?: ToolApprovalDecisionTag;
}): Message {
  const approvalError = formatToolErrorResponse(
    params.toolName,
    params.reason,
    "APPROVAL_REQUIRED",
  );

  return {
    role: "tool",
    name: params.toolName,
    content: approvalError.content,
    status: "pending",
    data: {
      ...approvalError.data,
      renderer: "approval_request",
      message: params.reason,
      options: ["Approve", "Reject"],
      approvalRequired: true,
      approval: {
        toolName: params.toolName,
        toolCallId: params.toolCallId,
        interactionId: params.toolCallId,
        reason: params.reason,
        ...(params.decision ? { decision: params.decision } : {}),
      },
      humanInTheLoop: pendingApproval({
        interactionId: params.toolCallId,
        toolName: params.toolName,
      }),
    },
    log_id: params.logId,
    id: generateId(),
    tool_call_id: params.toolCallId,
    tool_call_arguments: params.toolCallArguments,
    timestamp: params.timestamp,
    model: params.model,
    platform: params.platform,
  };
}
