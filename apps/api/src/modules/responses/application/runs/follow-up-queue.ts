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
import { canonicalJson, generateId } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Task } from "~/infrastructure/database/schema";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { publishConversationChanged } from "~/modules/sync/application/conversation-events";
import { withoutOrigin } from "~/modules/sync/application/publish";

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
  const conversation = await context.repositories
    .get(ConversationRepository)
    .getConversation(conversationId);

  if (!conversation || conversation.project_id || !ownsResource(user.id, conversation.user_id)) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  return user;
}

async function hasActiveRun(context: QueueContext, conversationId: string): Promise<boolean> {
  const latest = await context.repositories
    .get(ConversationRunRepository)
    .getLatestForConversation(conversationId);

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
  const tasks = await context.repositories.get(TaskRepository).listSuspendedTasksForConversation({
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

function queuedInputDigest(data: Pick<QueuedChatTaskData, "message" | "request">): string {
  const { id: _id, ...message } = data.message;

  return canonicalJson({ message, request: data.request });
}

function presentReplayedFollowUp(
  task: Task,
  userId: number,
  conversationId: string,
  input: EnqueueChatMessageRequest,
): QueuedChatMessage {
  const parsed = queuedChatTaskDataSchema.safeParse(task.task_data);
  const queued = presentQueuedFollowUp(task);

  if (
    !parsed.success ||
    !queued ||
    task.user_id !== userId ||
    parsed.data.conversationId !== conversationId ||
    queuedInputDigest(parsed.data) !== queuedInputDigest(input)
  ) {
    throw new AssistantError(
      "This idempotency key was already used for a different queued message",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return queued;
}

async function queuedTaskId(userId: number, idempotencyKey: string | undefined): Promise<string> {
  if (!idempotencyKey) {
    return `queued_chat_${generateId()}`;
  }

  const digest = await sha256Hex(canonicalJson({ userId, idempotencyKey }));

  return `queued_chat_key_${digest.slice(0, 40)}`;
}

export async function queueFollowUp(
  context: ServiceContext,
  conversationId: string,
  input: EnqueueChatMessageRequest,
): Promise<QueuedChatMessage> {
  const user = await requireQueueableConversation(context, conversationId);
  const tasks = context.repositories.get(TaskRepository);
  const taskId = await queuedTaskId(user.id, input.idempotency_key);
  const replayed = input.idempotency_key ? await tasks.getTaskById(taskId) : null;

  if (replayed) {
    return presentReplayedFollowUp(replayed, user.id, conversationId, input);
  }

  const waiting = await tasks.listSuspendedTasksForConversation({
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
  let task: Task | null;

  try {
    task = await tasks.createTask({
      id: taskId,
      task_type: QUEUED_CHAT_MESSAGE_TASK_TYPE,
      user_id: user.id,
      task_data: taskData,
      priority: 6,
      created_by: "user",
      status: "suspended",
    });
  } catch (error) {
    const raced = input.idempotency_key ? await tasks.getTaskById(taskId) : null;

    if (!raced) {
      throw error;
    }

    return presentReplayedFollowUp(raced, user.id, conversationId, input);
  }

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
  const removed = await context.repositories.get(TaskRepository).cancelSuspendedTask({
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
  const task = await context.repositories
    .get(TaskRepository)
    .releaseNextSuspendedTaskForConversation({
      taskType: QUEUED_CHAT_MESSAGE_TASK_TYPE,
      conversationId,
    });

  if (!task) {
    return false;
  }

  try {
    await new TaskService(context.env, context.repositories.get(TaskRepository)).dispatchTask(task);
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

export async function releaseQueuedFollowUpWhenIdle(
  context: QueueContext,
  conversationId: string,
): Promise<boolean> {
  if (await hasActiveRun(context, conversationId)) {
    return false;
  }

  return releaseQueuedFollowUp(context, conversationId);
}

const STRANDED_AFTER_MS = 2 * 60 * 1000;
const STRANDED_BATCH_SIZE = 50;

export async function releaseStrandedQueuedFollowUps(
  context: QueueContext,
  now = new Date(),
): Promise<number> {
  const stranded = await context.repositories.get(TaskRepository).listSuspendedTasksUpdatedBefore({
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
    if (await releaseQueuedFollowUpWhenIdle(context, conversationId)) {
      released += 1;
    }
  }

  return released;
}
