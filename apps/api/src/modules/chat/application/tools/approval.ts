import { pendingApproval } from "@ngriffin_uk/polychat-library-interactions";
import { STANDING_APPROVAL_OPTION } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { formatToolErrorResponse } from "~/modules/chat/application/tools/tool-responses";
import { hasEarnedStandingOffer } from "~/modules/poly/domain/earned-trust";
import type { Message, Platform } from "~/types";

export function createPendingToolApprovalMessage(params: {
  toolName: string;
  toolCallId: string;
  toolCallArguments: unknown;
  reason: string;
  logId: string;
  timestamp: number;
  model: string;
  platform: Platform;
  standingEligible?: boolean;
  approvedInARow?: number;
}): Message {
  const approvedInARow = params.standingEligible ? (params.approvedInARow ?? 0) : 0;

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
      options: !params.standingEligible
        ? ["Approve", "Reject"]
        : hasEarnedStandingOffer(approvedInARow)
          ? [STANDING_APPROVAL_OPTION, "Approve", "Reject"]
          : ["Approve", STANDING_APPROVAL_OPTION, "Reject"],
      approvalRequired: true,
      approval: {
        toolName: params.toolName,
        toolCallId: params.toolCallId,
        interactionId: params.toolCallId,
        reason: params.reason,
        standingEligible: params.standingEligible === true,
        approvedInARow,
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
