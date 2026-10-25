import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  MAX_QUEUED_CHAT_MESSAGES,
  QUEUED_CHAT_MESSAGE_TASK_TYPE,
  queuedChatTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { removeQueuedFollowUp } from "~/modules/responses/application/runs/follow-up-queue";

export async function takeQueuedSteer(params: {
  context: ServiceContext;
  userId: number;
  conversationId: string;
  steer: (text: string) => Promise<boolean>;
}): Promise<boolean> {
  const tasks = await params.context.repositories
    .get(TaskRepository)
    .listSuspendedTasksForConversation({
      taskType: QUEUED_CHAT_MESSAGE_TASK_TYPE,
      userId: params.userId,
      conversationId: params.conversationId,
      limit: MAX_QUEUED_CHAT_MESSAGES,
    });

  for (const task of tasks) {
    const parsed = queuedChatTaskDataSchema.safeParse(task.task_data);
    const text = parsed.success
      ? extractTextFromMessageContent(parsed.data.message.content).trim()
      : "";

    if (!text) {
      continue;
    }

    if (!(await params.steer(text))) {
      return false;
    }

    await removeQueuedFollowUp(params.context, params.conversationId, task.id).catch(
      () => undefined,
    );

    return true;
  }

  return false;
}
