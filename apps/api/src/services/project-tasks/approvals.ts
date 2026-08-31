import {
  projectTaskToolApprovalSchema,
  resolveProjectTaskToolApprovalSchema,
  type ProjectTask,
  type ProjectTaskToolApproval,
  type ResolveProjectTaskToolApprovalInput,
} from "@ngriffin_uk/polychat-schemas";

import { buildMessageParts } from "~/lib/chat/messages/parts";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { isRecord } from "~/utils/objects";

import { readInteractionMessageData } from "./interaction-messages";

interface PendingApprovalMessage {
  messageId: string;
  data: Record<string, unknown>;
  approval: ProjectTaskToolApproval;
  toolCallId?: string;
  timestamp?: number;
}

export async function getPendingProjectTaskToolApproval(
  context: ServiceContext,
  task: Pick<ProjectTask, "conversationId">,
): Promise<ProjectTaskToolApproval | null> {
  if (!task.conversationId) {
    return null;
  }

  const pending = await getPendingApprovalMessage(context, task.conversationId);

  return pending?.approval ?? null;
}

async function getPendingApprovalMessage(
  context: ServiceContext,
  conversationId: string,
): Promise<PendingApprovalMessage | null> {
  const message = await context.repositories.messages.getLatestPendingToolMessage(conversationId);
  const data = readInteractionMessageData(message?.data);
  const approval = projectTaskToolApprovalSchema.safeParse(
    data && isRecord(data.approval) ? data.approval : undefined,
  );

  if (!message || !data || !approval.success || typeof message.id !== "string") {
    return null;
  }

  return {
    messageId: message.id,
    data,
    approval: approval.data,
    ...(typeof message.tool_call_id === "string" ? { toolCallId: message.tool_call_id } : {}),
    ...(typeof message.timestamp === "number" ? { timestamp: message.timestamp } : {}),
  };
}

export async function resolveProjectTaskToolApproval(params: {
  context: ServiceContext;
  task: ProjectTask;
  input: ResolveProjectTaskToolApprovalInput;
}): Promise<{ toolName: string; resolution: "approved" | "rejected" }> {
  const { context, task } = params;
  const input = resolveProjectTaskToolApprovalSchema.parse(params.input);

  if (task.status !== "blocked" || task.blockedReason !== "awaiting_approval") {
    throw new AssistantError(
      "This task is not waiting for tool approval",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (!task.conversationId) {
    throw new AssistantError(
      "This task has no conversation to resume",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const pending = await getPendingApprovalMessage(context, task.conversationId);

  if (!pending || pending.approval.interactionId !== input.interactionId) {
    throw new AssistantError(
      "This approval is no longer pending. Refresh the conversation.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const resolvedAt = new Date().toISOString();
  const resolvedData = {
    ...pending.data,
    resolved: true,
    resolvedAt,
    resolution: input.resolution,
    approval: {
      ...pending.approval,
      status: input.resolution,
    },
    humanInTheLoop: {
      type: "approval",
      status: "resolved",
      interactionId: input.interactionId,
      toolName: pending.approval.toolName,
      resolution: input.resolution,
      requires_user_action: false,
    },
  };
  const resolvedMessage: Message = {
    role: "tool",
    name: pending.approval.toolName,
    content: input.resolution === "approved" ? "Tool access approved." : "Tool access rejected.",
    status: "resolved",
    data: resolvedData,
    tool_call_id: pending.toolCallId,
    timestamp: pending.timestamp,
  };

  await context.repositories.messages.updateMessage(task.conversationId, pending.messageId, {
    content: resolvedMessage.content,
    status: resolvedMessage.status,
    data: resolvedData,
    parts: buildMessageParts(resolvedMessage),
  });

  const user = context.requireUser();
  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    repositories: context.repositories,
    user,
    env: context.env,
    store: true,
  });

  await conversationManager.add(task.conversationId, {
    id: generateId(),
    role: "user",
    content:
      input.resolution === "approved"
        ? `Approved access to ${pending.approval.toolName}. Continue the task.`
        : `Rejected access to ${pending.approval.toolName}. Continue without it.`,
    data: {
      toolApprovalResponse: {
        interactionId: input.interactionId,
        resolution: input.resolution,
        toolName: pending.approval.toolName,
      },
    },
    timestamp: Date.now(),
    platform: "web",
  });

  return { toolName: pending.approval.toolName, resolution: input.resolution };
}
