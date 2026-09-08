import { DELEGATION_WAKE_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { TaskService } from "~/services/tasks/TaskService";

export async function scheduleDelegationWake(
  tasks: TaskService,
  delegation: { id: string; parentConversationId: string; parentRunId: string },
  userId: number | undefined,
): Promise<void> {
  if (userId === undefined) {
    return;
  }

  await tasks.enqueueTask({
    id: `delegation_wake_${delegation.id}`,
    task_type: DELEGATION_WAKE_TASK_TYPE,
    user_id: userId,
    priority: 4,
    task_data: {
      parentConversationId: delegation.parentConversationId,
      parentRunId: delegation.parentRunId,
    },
  });
}
