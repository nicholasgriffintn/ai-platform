import { DISCOVER_JOB_TASK_TYPE, type DiscoverJobTaskData } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";

export async function enqueueDiscoverJob(
  context: ServiceContext,
  job: DiscoverJobTaskData,
): Promise<void> {
  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    task_type: DISCOVER_JOB_TASK_TYPE,
    user_id: context.requireUser().id,
    task_data: { ...job, runId: job.runId ?? context.executionRunId },
    priority: 6,
  });
}
