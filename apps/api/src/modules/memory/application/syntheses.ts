import { listPageOf, type TriggerMemorySynthesisRequest } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/tasks/application/TaskService";

export async function createMemorySynthesisTask(
  context: ServiceContext,
  userId: number,
  input: TriggerMemorySynthesisRequest,
) {
  const taskService = new TaskService(context.env, context.repositories.tasks);
  const taskId = await taskService.enqueueTask({
    task_type: "memory_synthesis",
    user_id: userId,
    task_data: { namespace: input.namespace || "global" },
    priority: 7,
  });

  return {
    task_id: taskId,
    status: "queued",
    message: "Memory synthesis task queued successfully",
  };
}

export async function listMemorySyntheses(
  context: ServiceContext,
  userId: number,
  filters: { namespace?: string; active?: boolean; limit: number },
) {
  if (filters.active) {
    const active = await context.repositories.memorySyntheses.getActiveSynthesis(
      userId,
      filters.namespace || "global",
    );

    return listPageOf(active ? [active] : [], (synthesis) => synthesis.id);
  }

  const syntheses = await context.repositories.memorySyntheses.getSynthesesByUserId(
    userId,
    filters.namespace,
    filters.limit,
  );

  return listPageOf(syntheses, (synthesis) => synthesis.id);
}
