import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  AGENT_HOST_MAX_STEER_CHARS,
  MAX_QUEUED_CHAT_MESSAGES,
  QUEUED_CHAT_MESSAGE_TASK_TYPE,
  queuedChatTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  queueFollowUp,
  removeQueuedFollowUp,
} from "~/modules/chat-runs/application/follow-up-queue";

import type { AgentHostClient } from "./AgentHostClient";

export type QueuedSteerOutcome = "steered" | "not-accepting" | "none";

async function peekQueuedSteerText(params: {
  context: ServiceContext;
  userId: number;
  conversationId: string;
}): Promise<{ taskId: string; text: string } | null> {
  const tasks = await params.context.repositories.tasks.listSuspendedTasksForConversation({
    taskType: QUEUED_CHAT_MESSAGE_TASK_TYPE,
    userId: params.userId,
    conversationId: params.conversationId,
    limit: MAX_QUEUED_CHAT_MESSAGES,
  });

  for (const task of tasks) {
    const parsed = queuedChatTaskDataSchema.safeParse(task.task_data);

    if (!parsed.success) {
      continue;
    }

    const text = extractTextFromMessageContent(parsed.data.message.content).trim();

    if (!text) {
      continue;
    }

    return {
      taskId: task.id,
      text:
        text.length > AGENT_HOST_MAX_STEER_CHARS ? text.slice(0, AGENT_HOST_MAX_STEER_CHARS) : text,
    };
  }

  return null;
}

export async function maybeSteerQueuedFollowUp(params: {
  context: ServiceContext;
  userId: number;
  conversationId: string;
  hostId: string;
  runId: string;
  client: AgentHostClient;
}): Promise<QueuedSteerOutcome> {
  const queued = await peekQueuedSteerText(params).catch(() => null);

  if (!queued) {
    return "none";
  }

  try {
    await params.client.steerRun({
      hostId: params.hostId,
      runId: params.runId,
      input: queued.text,
    });
  } catch (error) {
    if (error instanceof AssistantError && error.type === ErrorType.CONFLICT_ERROR) {
      return "not-accepting";
    }

    return "none";
  }

  await removeQueuedFollowUp(params.context, params.conversationId, queued.taskId).catch(
    () => undefined,
  );

  return "steered";
}

export async function replayPendingSteer(params: {
  context: ServiceContext;
  conversationId: string;
  pendingSteer?: string;
}): Promise<void> {
  const text = params.pendingSteer?.trim();

  if (!text) {
    return;
  }

  await queueFollowUp(params.context, params.conversationId, {
    message: {
      role: "user",
      content:
        text.length > AGENT_HOST_MAX_STEER_CHARS ? text.slice(0, AGENT_HOST_MAX_STEER_CHARS) : text,
    },
    request: {},
  }).catch(() => undefined);
}
