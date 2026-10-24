import { NOTEBOOK_JOB_TASK_TYPE, type NotebookJobTaskData } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";

export async function enqueueNotebookJob(
  context: ServiceContext,
  projectId: string | null,
  job: NotebookJobTaskData,
  taskId?: string,
): Promise<void> {
  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    id: taskId,
    task_type: NOTEBOOK_JOB_TASK_TYPE,
    user_id: context.requireUser().id,
    project_id: projectId ?? undefined,
    task_data: job,
    priority: job.job === "guide" ? 4 : 6,
  });
}
