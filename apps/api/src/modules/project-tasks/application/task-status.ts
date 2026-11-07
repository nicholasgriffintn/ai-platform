import type { ProjectTask, ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  ProjectTaskRepository,
  type UpdateProjectTaskParams,
} from "../infrastructure/ProjectTaskRepository";
import { assertProjectTaskTransition } from "./transitions";

export async function transitionProjectTask(
  context: ServiceContext,
  task: ProjectTask,
  to: ProjectTaskStatus,
  updates: Omit<UpdateProjectTaskParams, "status"> = {},
): Promise<ProjectTask> {
  assertProjectTaskTransition({ actor: "system", from: task.status, to });

  const updated = await context.repositories
    .get(ProjectTaskRepository)
    .updateTask(task.id, { ...updates, status: to }, { fromStatuses: [task.status] });

  if (!updated) {
    throw new AssistantError(
      "This task changed before it could be updated. Refresh and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return updated;
}
