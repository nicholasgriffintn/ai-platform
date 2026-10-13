import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  MAX_QUEUED_CHAT_MESSAGES,
  QUEUED_CHAT_MESSAGE_TASK_TYPE,
  isTerminalChatRunStatus,
  queuedChatTaskDataSchema,
  type ChatRun,
  type EnqueueChatMessageRequest,
  type QueuedChatMessage,
  type QueuedChatTaskData,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Task } from "~/infrastructure/database/schema";
import { publishConversationChanged } from "~/modules/sync/application/conversation-events";
import { withoutOrigin } from "~/modules/sync/application/publish";
import { TaskService } from "~/modules/tasks/application/TaskService";

const logger = getLogger({ prefix: "services/chat-runs/follow-up-queue" });

const PREVIEW_MAX_CHARS = 200;

type QueueContext = Pick<ServiceContext, "env" | "repositories" | "waitUntil">;

function messageText(message: QueuedChatTaskData["message"]): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join(" ");
}

function attachmentCount(message: QueuedChatTaskData["message"]): number {
  return Array.isArray(message.content)
    ? message.content.filter((part) => part.type !== "text").length
    : 0;
}

export function presentQueuedFollowUp(task: Task): QueuedChatMessage | null {
  const parsed = queuedChatTaskDataSchema.safeParse(task.task_data);

  if (!parsed.success) {
    return null;
  }

  return {
    id: task.id,
    conversationId: parsed.data.conversationId,
    preview: messageText(parsed.data.message).trim().slice(0, PREVIEW_MAX_CHARS),
    attachmentCount: attachmentCount(parsed.data.message),
    createdAt: task.created_at,
  };
}

async function requireQueueableConversation(context: ServiceContext, conversationId: string) {
  const user = context.requireUser();
  const conversation = await context.repositories.conversations.getConversation(conversationId);

  if (!conversation || conversation.project_id || !ownsResource(user.id, conversation.user_id)) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  return user;
}

async function hasActiveRun(context: QueueContext, conversationId: string): Promise<boolean> {
  const latest =
    await context.repositories.conversationRuns.getLatestForConversation(conversationId);

  return latest !== null && !isTerminalChatRunStatus(latest.status);
}

async function announceQueueChanged(context: QueueContext, conversationId: string) {
  try {
    await publishConversationChanged(withoutOrigin(context), conversationId, {
      queuedMessages: true,
    });
  } catch (error) {
    logger.warn("Could not publish queued follow-up change", {
      conversationId,
      error: getErrorMessage(error),
    });
  }
}

export async function listQueuedFollowUps(
  context: ServiceContext,
  conversationId: string,
): Promise<QueuedChatMessage[]> {
  const user = await requireQueueableConversation(context, conversationId);
  const tasks = await context.repositories.tasks.listSuspendedTasksForConversation({
    taskType: QUEUED_CHAT_MESSAGE_TASK_TYPE,
    userId: user.id,
    conversationId,
    limit: MAX_QUEUED_CHAT_MESSAGES,
  });

  return tasks.flatMap((task) => {
    const queued = presentQueuedFollowUp(task);

    return queued ? [queued] : [];
  });
}

export async function queueFollowUp(
  context: ServiceContext,
  conversationId: string,
  input: EnqueueChatMessageRequest,
): Promise<QueuedChatMessage> {
  const user = await requireQueueableConversation(context, conversationId);
  const waiting = await context.repositories.tasks.listSuspendedTasksForConversation({
    taskType: QUEUED_CHAT_MESSAGE_TASK_TYPE,
    userId: user.id,
    conversationId,
    limit: MAX_QUEUED_CHAT_MESSAGES,
  });

  if (waiting.length >= MAX_QUEUED_CHAT_MESSAGES) {
    throw new AssistantError(
      `You can queue up to ${MAX_QUEUED_CHAT_MESSAGES} messages. Let the reply catch up first.`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const taskData: QueuedChatTaskData = {
    conversationId,
    message: { ...input.message, id: input.message.id ?? generateId() },
    request: input.request,
  };
  const task = await context.repositories.tasks.createTask({
    id: `queued_chat_${generateId()}`,
    task_type: QUEUED_CHAT_MESSAGE_TASK_TYPE,
    user_id: user.id,
    task_data: taskData,
    priority: 6,
    created_by: "user",
    status: "suspended",
  });
  const queued = task ? presentQueuedFollowUp(task) : null;

  if (!queued) {
    throw new AssistantError("The message could not be queued", ErrorType.INTERNAL_ERROR, 500);
  }

  await announceQueueChanged(context, conversationId);

  if (!(await hasActiveRun(context, conversationId))) {
    await releaseQueuedFollowUp(context, conversationId);
  }

  return queued;
}

export async function removeQueuedFollowUp(
  context: ServiceContext,
  conversationId: string,
  queuedId: string,
): Promise<{ removed: boolean }> {
  const user = await requireQueueableConversation(context, conversationId);
  const removed = await context.repositories.tasks.cancelSuspendedTask({
    taskId: queuedId,
    taskType: QUEUED_CHAT_MESSAGE_TASK_TYPE,
    userId: user.id,
  });

  if (removed) {
    await announceQueueChanged(context, conversationId);
  }

  return { removed };
}

export async function releaseQueuedFollowUp(
  context: QueueContext,
  conversationId: string,
): Promise<boolean> {
  const task = await context.repositories.tasks.releaseNextSuspendedTaskForConversation({
    taskType: QUEUED_CHAT_MESSAGE_TASK_TYPE,
    conversationId,
  });

  if (!task) {
    return false;
  }

  try {
    await new TaskService(context.env, context.repositories.tasks).dispatchTask(task);
  } catch (error) {
    logger.warn("Queued follow-up remains pending for recovery", {
      taskId: task.id,
      conversationId,
      error: getErrorMessage(error),
    });
  }

  await announceQueueChanged(context, conversationId);

  return true;
}

export async function releaseQueuedFollowUpAfterRun(
  context: QueueContext,
  run: ChatRun,
): Promise<void> {
  if (!isTerminalChatRunStatus(run.status)) {
    return;
  }

  try {
    await releaseQueuedFollowUp(context, run.conversationId);
  } catch (error) {
    logger.warn("Could not release a queued follow-up", {
      runId: run.id,
      error: getErrorMessage(error),
    });
  }
}

const STRANDED_AFTER_MS = 2 * 60 * 1000;
const STRANDED_BATCH_SIZE = 50;

export async function releaseStrandedQueuedFollowUps(
  context: QueueContext,
  now = new Date(),
): Promise<number> {
  const stranded = await context.repositories.tasks.listSuspendedTasksUpdatedBefore({
    taskType: QUEUED_CHAT_MESSAGE_TASK_TYPE,
    updatedBefore: new Date(now.getTime() - STRANDED_AFTER_MS).toISOString(),
    limit: STRANDED_BATCH_SIZE,
  });
  const conversationIds = new Set(
    stranded.flatMap((task) => {
      const parsed = queuedChatTaskDataSchema.safeParse(task.task_data);

      return parsed.success ? [parsed.data.conversationId] : [];
    }),
  );
  let released = 0;

  for (const conversationId of conversationIds) {
    if (await hasActiveRun(context, conversationId)) {
      continue;
    }

    if (await releaseQueuedFollowUp(context, conversationId)) {
      released += 1;
    }
  }

  return released;
}
