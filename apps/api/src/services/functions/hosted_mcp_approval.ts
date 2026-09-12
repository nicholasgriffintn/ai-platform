import { HOSTED_MCP_APPROVAL_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

const hostedMcpApprovalInputSchema = z
  .object({
    approvalRequestId: z.string().min(1),
    serverLabel: z.string().min(1),
    toolName: z.string().min(1),
    arguments: z.unknown().optional(),
  })
  .strict();

export const hostedMcpApproval: ApiToolDefinition = {
  name: HOSTED_MCP_APPROVAL_TOOL_NAME,
  description: "Persist an exact approval request emitted by a hosted MCP server.",
  type: "normal",
  permissions: ["human"],
  inputSchema: hostedMcpApprovalInputSchema,
  execute: async (input, context) => {
    if (!context.toolCallId || context.toolCallId !== input.approvalRequestId) {
      throw new AssistantError(
        "Hosted MCP approval identity is invalid",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const message = `${input.serverLabel} wants to run ${input.toolName}.`;

    return {
      name: HOSTED_MCP_APPROVAL_TOOL_NAME,
      status: "pending",
      content: message,
      data: {
        renderer: "approval_request",
        message,
        options: ["Approve", "Reject"],
        approvalRequired: true,
        approval: {
          toolName: HOSTED_MCP_APPROVAL_TOOL_NAME,
          toolCallId: input.approvalRequestId,
          interactionId: input.approvalRequestId,
          reason: message,
        },
        context: {
          serverLabel: input.serverLabel,
          toolName: input.toolName,
          arguments: input.arguments,
        },
        humanInTheLoop: {
          type: "approval",
          status: "pending",
          interactionId: input.approvalRequestId,
          toolName: HOSTED_MCP_APPROVAL_TOOL_NAME,
          requires_user_action: true,
        },
      },
    };
  },
};
