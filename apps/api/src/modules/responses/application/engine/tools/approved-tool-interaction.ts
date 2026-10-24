import { mergeHumanInTheLoop } from "@ngriffin_uk/polychat-library-interactions";
import { STANDING_APPROVAL_OPTION, type ChatRun } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ConversationManager } from "~/modules/conversations/application/manager";
import { buildMessageParts } from "~/modules/responses/application/engine/messages/parts";
import { handleToolCalls } from "~/modules/responses/application/engine/tools/execution";
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
  toolCalls: ToolCall[];
  toolResults: Message[];
  suppressedMessageIds: string[];
  updates: Message[];
}

interface PreparedApproval {
  pending: Message;
  pendingData: Record<string, unknown>;
  toolCall: ToolCall;
  toolName: string;
  option: string;
  resolution: "approved" | "rejected";
  requiresActionApproval: boolean;
  resolutionData: Record<string, unknown>;
}

function failApproval(): never {
  throw new AssistantError(
    "The approval no longer matches a pending tool call",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

function parseToolInteraction(value: unknown): ToolInteraction | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { toolName, response } = value;

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

function readToolInteractions(options: unknown): ToolInteraction[] | undefined {
  if (!isRecord(options)) {
    return undefined;
  }

  const raw = Array.isArray(options.toolInteractions)
    ? options.toolInteractions
    : options.toolInteraction
      ? [options.toolInteraction]
      : [];
  const interactions = raw.flatMap((value) => {
    const interaction = parseToolInteraction(value);

    return interaction ? [interaction] : [];
  });

  return interactions.length > 0 && interactions.length === raw.length ? interactions : undefined;
}

function isFirstPartyApproval(interaction: ToolInteraction): boolean {
  return (
    interaction.response.approvalRequired === true || interaction.toolName === "request_approval"
  );
}

function isPendingApproval(message: Message, runId: string): boolean {
  return (
    message.role === "tool" &&
    message.status === "pending" &&
    message.run_id === runId &&
    isRecord(message.data) &&
    message.data.renderer === "approval_request"
  );
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

function prepareApproval(params: {
  interaction: ToolInteraction;
  pending: Message;
  messages: readonly Message[];
  providerMessages: readonly Message[];
  userId: number;
  resolvedAt: string;
}): PreparedApproval {
  const { interaction, pending, messages } = params;
  const pendingIndex = messages.indexOf(pending);
  const pendingData = isRecord(pending.data) ? pending.data : undefined;
  const approval = isRecord(pendingData?.approval) ? pendingData.approval : undefined;
  const interactionId = interaction.response.interactionId;
  const toolName = typeof pending.name === "string" ? pending.name : undefined;
  const option = typeof interaction.response.option === "string" ? interaction.response.option : "";
  const resolution = interaction.response.resolution;
  const storedOptions = Array.isArray(pendingData?.options)
    ? pendingData.options.filter((candidate): candidate is string => typeof candidate === "string")
    : [];
  const options = storedOptions.length > 0 ? storedOptions : ["Approve", "Reject"];

  if (
    !pendingData ||
    !toolName ||
    pendingIndex < 0 ||
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

  const originalCall = messages
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

  return {
    pending,
    pendingData,
    toolName,
    option,
    resolution,
    requiresActionApproval,
    toolCall: {
      id: interactionId,
      type: ToolCallType.FUNCTION,
      function: { name: toolName, arguments: canonicalJson(storedArguments) },
    },
    resolutionData: resolveApprovalData({
      pendingData,
      interactionId,
      toolName,
      option,
      resolution,
      userId: params.userId,
      resolvedAt: params.resolvedAt,
    }),
  };
}

async function executeApprovedTools(
  prepared: readonly PreparedApproval[],
  params: { conversationId: string; conversationManager: ConversationManager; request: IRequest },
): Promise<Map<string, Message>> {
  const approved = prepared.filter(
    (approval) => approval.requiresActionApproval && approval.resolution === "approved",
  );

  if (approved.length === 0) {
    return new Map();
  }

  const request = params.request.request;

  if (!request) {
    return failApproval();
  }

  const {
    toolInteraction: _toolInteraction,
    toolInteractions: _toolInteractions,
    ...requestOptions
  } = request.options ?? {};
  const results = await handleToolCalls(
    params.conversationId,
    { response: "", tool_calls: approved.map((approval) => approval.toolCall) },
    params.conversationManager,
    {
      ...params.request,
      request: {
        ...request,
        approved_tools: [...new Set(approved.map((approval) => approval.toolName))],
        options: requestOptions,
      },
    },
    { persistResults: "none", recoverUnknownToolCalls: false },
  );
  const resultsByCallId = new Map(
    results.flatMap((result) =>
      typeof result.tool_call_id === "string" ? [[result.tool_call_id, result] as const] : [],
    ),
  );

  if (
    results.length !== approved.length ||
    approved.some((approval) => {
      const result = resultsByCallId.get(approval.toolCall.id);

      return !result || result.status === "pending";
    })
  ) {
    return failApproval();
  }

  return resultsByCallId;
}

function settledToolResult(approval: PreparedApproval, executed: Message | undefined): Message {
  const { pending, toolCall, toolName, resolutionData } = approval;

  if (executed) {
    return {
      ...executed,
      id: pending.id,
      run_id: pending.run_id,
      tool_call_id: toolCall.id,
      tool_call_arguments: pending.tool_call_arguments,
      data: {
        ...(isRecord(executed.data) ? executed.data : {}),
        approvalResolution: resolutionData.approvalResolution,
      },
    };
  }

  const responseMessage: Message = {
    ...pending,
    content:
      toolName === "request_approval"
        ? `The user selected: ${approval.option}`
        : "The user rejected the proposed action.",
    status: "success",
    data: resolutionData,
  };

  return { ...responseMessage, parts: buildMessageParts(responseMessage) };
}

export async function resolveApprovedToolInteraction(params: {
  conversationId: string;
  conversationManager: ConversationManager;
  loadMessages: () => Promise<readonly Message[]>;
  providerMessages: readonly Message[];
  request: IRequest;
  run: ChatRun | null;
}): Promise<ApprovedToolInteractionResult | undefined> {
  const interactions = readToolInteractions(params.request.request?.options);

  if (!interactions || !interactions.some(isFirstPartyApproval)) {
    return undefined;
  }

  const run = params.run;
  const userId = params.request.user?.id;

  if (
    !interactions.every(isFirstPartyApproval) ||
    !run ||
    !userId ||
    run.conversationId !== params.conversationId ||
    run.initiatorUserId !== userId ||
    run.status !== "running" ||
    !run.lastMessageId
  ) {
    return failApproval();
  }

  const messages = await params.loadMessages();
  const pendingApprovals = messages.filter((message) => isPendingApproval(message, run.id));
  const interactionsById = new Map(
    interactions.map((interaction) => [interaction.response.interactionId, interaction]),
  );

  if (
    !pendingApprovals.some((message) => message.id === run.lastMessageId) ||
    interactionsById.size !== interactions.length ||
    pendingApprovals.length !== interactions.length
  ) {
    return failApproval();
  }

  const resolvedAt = new Date().toISOString();
  const prepared = pendingApprovals.map((pending) => {
    const interaction =
      typeof pending.tool_call_id === "string"
        ? interactionsById.get(pending.tool_call_id)
        : undefined;

    if (!interaction) {
      return failApproval();
    }

    return prepareApproval({
      interaction,
      pending,
      messages,
      providerMessages: params.providerMessages,
      userId,
      resolvedAt,
    });
  });
  const executed = await executeApprovedTools(prepared, params);
  const toolResults = prepared.map((approval) =>
    settledToolResult(approval, executed.get(approval.toolCall.id)),
  );
  const hiddenApprovalContents = new Set(
    pendingApprovals.flatMap((pending) =>
      typeof pending.content === "string" && pending.content.trim() ? [pending.content.trim()] : [],
    ),
  );
  const duplicateAssistantMessages = messages.filter(
    (message) =>
      message.role === "assistant" &&
      message.status === "pending" &&
      typeof message.content === "string" &&
      hiddenApprovalContents.has(message.content.trim()),
  );
  const updates = [
    ...toolResults,
    ...duplicateAssistantMessages.map((message) => ({
      ...message,
      content: "",
      parts: [],
      status: "completed",
    })),
  ];

  await params.conversationManager.update(params.conversationId, updates);

  return {
    toolCalls: prepared.map((approval) => approval.toolCall),
    toolResults,
    suppressedMessageIds: duplicateAssistantMessages.flatMap((message) =>
      message.id ? [message.id] : [],
    ),
    updates,
  };
}
