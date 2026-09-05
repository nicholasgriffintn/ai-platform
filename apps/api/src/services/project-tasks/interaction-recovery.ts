import { buildMessageParts } from "~/lib/chat/messages/parts";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationWriteFence } from "~/lib/conversation/write-fence";
import type { Message } from "~/types";
import { isRecord } from "~/utils/objects";

import { readInteractionMessageData } from "./interaction-messages";

export const PROJECT_TASK_INTERACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function messageTimeMs(message: Record<string, unknown>): number | null {
  const data = readInteractionMessageData(message.data);
  const requestedAt = typeof data?.requestedAt === "string" ? Date.parse(data.requestedAt) : NaN;

  if (Number.isFinite(requestedAt)) {
    return requestedAt;
  }

  if (typeof message.created_at === "string") {
    const parsed = Date.parse(message.created_at);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function isProjectTaskInteractionExpired(
  message: Record<string, unknown>,
  now = Date.now(),
): boolean {
  const createdAt = messageTimeMs(message);

  return createdAt !== null && now - createdAt >= PROJECT_TASK_INTERACTION_TTL_MS;
}

export async function recoverPendingProjectTaskInteraction(params: {
  context: ServiceContext;
  conversationId: string;
  kind: "input" | "approval";
  writeFence: ConversationWriteFence;
  now?: number;
}): Promise<{ recovered: true } | { recovered: false; reason: string }> {
  const message = await params.context.repositories.messages.getLatestPendingToolMessage(
    params.conversationId,
    params.kind === "input" ? ["ask_user"] : undefined,
  );

  if (!message || typeof message.id !== "string") {
    return {
      recovered: false,
      reason: "The pending interaction could not be recovered from stored conversation state.",
    };
  }

  if (!isProjectTaskInteractionExpired(message, params.now)) {
    return { recovered: true };
  }

  const data = readInteractionMessageData(message.data) ?? {};
  const expiredAt = new Date(params.now ?? Date.now()).toISOString();
  const humanInTheLoop = isRecord(data.humanInTheLoop) ? data.humanInTheLoop : {};
  const expiredData = {
    ...data,
    resolved: true,
    expiredAt,
    humanInTheLoop: {
      ...humanInTheLoop,
      status: "expired",
      requires_user_action: false,
    },
  };
  const expiredMessage: Message = {
    role: "tool",
    name: typeof message.name === "string" ? message.name : undefined,
    content: "This interaction expired before the durable task resumed.",
    status: "resolved",
    data: expiredData,
    tool_call_id: typeof message.tool_call_id === "string" ? message.tool_call_id : undefined,
    timestamp: typeof message.timestamp === "number" ? message.timestamp : undefined,
  };

  await params.writeFence.assertOwned();
  await params.context.repositories.messages.updateMessage(params.conversationId, message.id, {
    content: expiredMessage.content,
    status: expiredMessage.status,
    data: expiredData,
    parts: buildMessageParts(expiredMessage),
  });

  return {
    recovered: false,
    reason: "The pending interaction expired before the durable task resumed.",
  };
}
