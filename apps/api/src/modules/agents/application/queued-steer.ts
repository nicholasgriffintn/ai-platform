import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  AGENT_HARNESS_MAX_INPUT_CHARS,
  MAX_QUEUED_CHAT_MESSAGES,
  QUEUED_CHAT_MESSAGE_TASK_TYPE,
  queuedChatTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { removeQueuedFollowUp } from "~/modules/chat-runs/application/follow-up-queue";

export async function takeQueuedSteer(params: {
  context: ServiceContext;
  userId: number;
  conversationId: string;
  steer: (text: string) => Promise<boolean>;
}): Promise<boolean> {
  const tasks = await params.context.repositories.tasks.listSuspendedTasksForConversation({
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

    if (!(await params.steer(text.slice(0, AGENT_HARNESS_MAX_INPUT_CHARS)))) {
      return false;
    }

    await removeQueuedFollowUp(params.context, params.conversationId, task.id).catch(
      () => undefined,
    );

    return true;
  }

  return false;
}
