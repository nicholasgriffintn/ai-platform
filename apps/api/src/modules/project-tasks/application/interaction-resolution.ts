import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { buildMessageParts } from "~/modules/chat/application/messages/parts";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { withThreadLock } from "~/modules/conversations/infrastructure/coordinator/client";
import type { Message } from "~/types";

import { readInteractionMessageData } from "./interaction-messages";
import { isProjectTaskInteractionExpired } from "./interaction-recovery";

export interface PendingInteractionMessage<TInteraction> {
  messageId: string;
  data: Record<string, unknown>;
  interaction: TInteraction;
  toolCallId?: string;
  timestamp?: number;
}

export async function readPendingInteractionMessage<TInteraction>(params: {
  context: ServiceContext;
  conversationId: string;
  toolNames?: string[];
  parse: (data: Record<string, unknown>) => TInteraction | null;
}): Promise<PendingInteractionMessage<TInteraction> | null> {
  const message = params.toolNames
    ? await params.context.repositories.messages.getLatestPendingToolMessage(
        params.conversationId,
        params.toolNames,
      )
    : await params.context.repositories.messages.getLatestPendingToolMessage(params.conversationId);
  const data = readInteractionMessageData(message?.data);
  const interaction = data ? params.parse(data) : null;

  if (
    !message ||
    !data ||
    !interaction ||
    typeof message.id !== "string" ||
    isProjectTaskInteractionExpired(message)
  ) {
    return null;
  }

  return {
    messageId: message.id,
    data,
    interaction,
    ...(typeof message.tool_call_id === "string" ? { toolCallId: message.tool_call_id } : {}),
    ...(typeof message.timestamp === "number" ? { timestamp: message.timestamp } : {}),
  };
}

export interface PendingInteractionResolution {
  data: Record<string, unknown>;
  toolName: string;
  toolContent: string;
  userContent: string;
  userData: Record<string, unknown>;
}

export async function resolvePendingInteraction<TInteraction>(params: {
  context: ServiceContext;
  task: ProjectTask;
  conversationId: string;
  expectedInteractionId: string;
  interactionIdOf: (interaction: TInteraction) => string;
  conflictMessage: string;
  readPending: (conversationId: string) => Promise<PendingInteractionMessage<TInteraction> | null>;
  buildResolution: (
    pending: PendingInteractionMessage<TInteraction>,
  ) => PendingInteractionResolution;
}): Promise<PendingInteractionMessage<TInteraction>> {
  const pending = await params.readPending(params.conversationId);

  if (!pending || params.interactionIdOf(pending.interaction) !== params.expectedInteractionId) {
    throw new AssistantError(params.conflictMessage, ErrorType.CONFLICT_ERROR, 409);
  }

  const user = params.context.requireUser();
  let resolved = pending;

  await withThreadLock(
    { env: params.context.env, conversationId: params.conversationId, kind: "human_response" },
    async (lease) => {
      const current = await params.readPending(params.conversationId);

      if (
        !current ||
        params.interactionIdOf(current.interaction) !== params.expectedInteractionId
      ) {
        throw new AssistantError(params.conflictMessage, ErrorType.CONFLICT_ERROR, 409);
      }

      const resolution = params.buildResolution(current);
      const toolMessage: Message = {
        role: "tool",
        name: resolution.toolName,
        content: resolution.toolContent,
        status: "resolved",
        data: resolution.data,
        tool_call_id: current.toolCallId,
        timestamp: current.timestamp,
      };

      await lease.assertOwned();
      await params.context.repositories.messages.updateMessage(
        params.conversationId,
        current.messageId,
        {
          content: toolMessage.content,
          status: toolMessage.status,
          data: resolution.data,
          parts: buildMessageParts(toolMessage),
        },
      );

      const conversationManager = ConversationManager.getInstance({
        database: params.context.database,
        repositories: params.context.repositories,
        user,
        env: params.context.env,
        store: true,
        runId: params.task.runId ?? undefined,
        writeFence: lease,
      });

      await conversationManager.add(params.conversationId, {
        id: generateId(),
        role: "user",
        content: resolution.userContent,
        data: resolution.userData,
        timestamp: Date.now(),
        platform: "web",
      });

      resolved = current;
    },
  );

  return resolved;
}
