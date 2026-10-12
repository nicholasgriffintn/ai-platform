import { mergeHumanInTheLoop } from "@ngriffin_uk/polychat-library-interactions";
import { STANDING_APPROVAL_OPTION, type ChatRun } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { buildMessageParts } from "~/modules/chat/application/messages/parts";
import { handleToolCalls } from "~/modules/chat/application/tools/execution";
import type { ConversationManager } from "~/modules/conversations/application/manager";
import { ToolCallType } from "~/types";
import type { IRequest, Message, ToolCall } from "~/types";

interface ToolInteraction {
  toolName: string;
  response: Record<string, unknown> & {
    interactionId: string;
    resolution: "approved" | "rejected";
  };
}

export interface ApprovedToolInteractionResult {
  toolCall: ToolCall;
  toolResult: Message;
  suppressedMessageIds: string[];
  updates: Message[];
}

function failApproval(): never {
  throw new AssistantError(
    "The approval no longer matches a pending tool call",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

function readToolInteraction(value: unknown): ToolInteraction | undefined {
  if (!isRecord(value) || !isRecord(value.toolInteraction)) {
    return undefined;
  }

  const { toolName, response } = value.toolInteraction;

  if (
    typeof toolName !== "string" ||
    !isRecord(response) ||
    typeof response.interactionId !== "string" ||
    (response.resolution !== "approved" && response.resolution !== "rejected")
  ) {
    return undefined;
  }

  return {
    toolName,
    response: {
      ...response,
      interactionId: response.interactionId,
      resolution: response.resolution,
    },
  };
}

function readArguments(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = safeParseJson<unknown>(value);

  return isRecord(parsed) ? parsed : undefined;
}

function resolveApprovalData(params: {
  pendingData: Record<string, unknown>;
  interactionId: string;
  toolName: string;
  option: string;
  resolution: "approved" | "rejected";
  userId: number;
  resolvedAt: string;
}): Record<string, unknown> {
  const approval = isRecord(params.pendingData.approval) ? params.pendingData.approval : {};

  return {
    ...params.pendingData,
    resolved: true,
    resolution: params.resolution,
    approval: {
      ...approval,
      status: "resolved",
      resolution: params.resolution,
      resolvedAt: params.resolvedAt,
      resolvedByUserId: params.userId,
    },
    humanInTheLoop: mergeHumanInTheLoop(params.pendingData.humanInTheLoop, {
      status: "resolved",
      requires_user_action: false,
      resolution: params.resolution,
      resolvedAt: params.resolvedAt,
    }),
    approvalResolution: {
      interactionId: params.interactionId,
      toolName: params.toolName,
      option: params.option,
      resolution: params.resolution,
      resolvedByUserId: params.userId,
      resolvedAt: params.resolvedAt,
    },
  };
}

export async function resolveApprovedToolInteraction(params: {
  conversationId: string;
  conversationManager: ConversationManager;
  messages: readonly Message[];
  providerMessages: readonly Message[];
  request: IRequest;
  run: ChatRun | null;
}): Promise<ApprovedToolInteractionResult | undefined> {
  const interaction = readToolInteraction(params.request.request?.options);

  if (!interaction) {
    return undefined;
  }

  const isFirstPartyApproval =
    interaction.response.approvalRequired === true || interaction.toolName === "request_approval";

  if (!isFirstPartyApproval) {
    return undefined;
  }

  const run = params.run;
  const userId = params.request.user?.id;

  if (
    !run ||
    !userId ||
    run.conversationId !== params.conversationId ||
    run.initiatorUserId !== userId ||
    run.status !== "running" ||
    !run.lastMessageId
  ) {
    return failApproval();
  }

  const pendingIndex = params.messages.findIndex((message) => message.id === run.lastMessageId);
  const pending = params.messages[pendingIndex];
  const pendingData = isRecord(pending?.data) ? pending.data : undefined;
  const approval = isRecord(pendingData?.approval) ? pendingData.approval : undefined;
  const interactionId = interaction.response.interactionId;
  const toolName = typeof pending?.name === "string" ? pending.name : undefined;
  const option = typeof interaction.response.option === "string" ? interaction.response.option : "";
  const resolution = interaction.response.resolution;
  const storedOptions = Array.isArray(pendingData?.options)
    ? pendingData.options.filter((candidate): candidate is string => typeof candidate === "string")
    : [];
  const options = storedOptions.length > 0 ? storedOptions : ["Approve", "Reject"];

  if (
    pending?.role !== "tool" ||
    pending.status !== "pending" ||
    !pendingData ||
    pendingData.renderer !== "approval_request"
  ) {
    return failApproval();
  }

  if (
    pendingIndex < 0 ||
    pending.run_id !== run.id ||
    pending.tool_call_id !== interactionId ||
    approval?.interactionId !== interactionId ||
    approval.toolName !== interaction.toolName ||
    toolName !== interaction.toolName ||
    !option ||
    !options.includes(option)
  ) {
    return failApproval();
  }

  const requiresActionApproval = pendingData.approvalRequired === true;

  if (
    (interaction.response.approvalRequired === true && !requiresActionApproval) ||
    (!requiresActionApproval && toolName !== "request_approval")
  ) {
    return failApproval();
  }

  if (requiresActionApproval) {
    const approves = option.toLowerCase() === "approve" || option === STANDING_APPROVAL_OPTION;

    if (
      resolution !== (approves ? "approved" : "rejected") ||
      (interaction.response.standing === true && option !== STANDING_APPROVAL_OPTION) ||
      (typeof interaction.response.approvedToolName === "string" &&
        interaction.response.approvedToolName !== toolName)
    ) {
      return failApproval();
    }
  }

  const originalCall = params.messages
    .slice(0, pendingIndex)
    .reverse()
    .flatMap((message) => (message.role === "assistant" ? (message.tool_calls ?? []) : []))
    .find((candidate) => candidate.id === interactionId);

  if (!originalCall || originalCall.function?.name !== toolName) {
    return failApproval();
  }

  if (
    !params.providerMessages.some(
      (message) =>
        message.role === "assistant" &&
        message.tool_calls?.some((call) => call.id === interactionId),
    ) ||
    !params.providerMessages.some((message) => message.id === pending.id)
  ) {
    return failApproval();
  }

  const storedArguments = readArguments(pending.tool_call_arguments);
  const originalArguments = readArguments(originalCall.function.arguments);

  if (
    !storedArguments ||
    !originalArguments ||
    canonicalJson(storedArguments) !== canonicalJson(originalArguments)
  ) {
    return failApproval();
  }

  const toolCall: ToolCall = {
    id: interactionId,
    type: ToolCallType.FUNCTION,
    function: {
      name: toolName,
      arguments: canonicalJson(storedArguments),
    },
  };
  const resolvedAt = new Date().toISOString();
  const resolutionData = resolveApprovalData({
    pendingData,
    interactionId,
    toolName,
    option,
    resolution,
    userId,
    resolvedAt,
  });

  let toolResult: Message;

  if (requiresActionApproval && resolution === "approved") {
    const request = params.request.request;

    if (!request) {
      return failApproval();
    }

    const { toolInteraction: _toolInteraction, ...requestOptions } = request.options ?? {};
    const results = await handleToolCalls(
      params.conversationId,
      { response: "", tool_calls: [toolCall] },
      params.conversationManager,
      {
        ...params.request,
        request: { ...request, approved_tools: [toolName], options: requestOptions },
      },
      { persistResults: "none", recoverUnknownToolCalls: false },
    );
    const result = results[0];

    if (results.length !== 1 || !result || result.status === "pending") {
      return failApproval();
    }

    toolResult = {
      ...result,
      id: pending.id,
      run_id: pending.run_id,
      tool_call_id: interactionId,
      tool_call_arguments: pending.tool_call_arguments,
      data: {
        ...(isRecord(result.data) ? result.data : {}),
        approvalResolution: resolutionData.approvalResolution,
      },
    };
  } else {
    const responseMessage: Message = {
      ...pending,
      content:
        toolName === "request_approval"
          ? `The user selected: ${option}`
          : "The user rejected the proposed action.",
      status: "success",
      data: resolutionData,
    };

    toolResult = { ...responseMessage, parts: buildMessageParts(responseMessage) };
  }

  const hiddenApprovalContent = typeof pending.content === "string" ? pending.content.trim() : "";
  const duplicateAssistantMessages = hiddenApprovalContent
    ? params.messages.filter(
        (message) =>
          message.role === "assistant" &&
          message.status === "pending" &&
          typeof message.content === "string" &&
          message.content.trim() === hiddenApprovalContent,
      )
    : [];
  const updates = [
    toolResult,
    ...duplicateAssistantMessages.map((message) => ({
      ...message,
      content: "",
      parts: [],
      status: "completed",
    })),
  ];

  await params.conversationManager.update(params.conversationId, updates);

  return {
    toolCall,
    toolResult,
    suppressedMessageIds: duplicateAssistantMessages.flatMap((message) =>
      message.id ? [message.id] : [],
    ),
    updates,
  };
}
