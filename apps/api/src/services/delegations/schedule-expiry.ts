import { DELEGATION_EXPIRY_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { TaskService } from "~/services/tasks/TaskService";

export async function scheduleDelegationExpiry(
  tasks: TaskService,
  delegation: { id: string; budget: { deadline: string } },
  userId: number,
): Promise<void> {
  await tasks.enqueueTask({
    id: `delegation_expiry_${delegation.id}`,
    task_type: DELEGATION_EXPIRY_TASK_TYPE,
    user_id: userId,
    priority: 4,
    schedule_type: "scheduled",
    scheduled_at: delegation.budget.deadline,
    task_data: { delegationId: delegation.id },
  });
}
