import {
  PROJECT_REVIEW_INTAKE_TASK_TYPE,
  PROJECT_TASK_RUN_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { ProjectReviewIntakeHandler } from "~/modules/project-tasks/application/review-intake";
import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { ProjectTaskRunHandler } from "./ProjectTaskRunHandler";

export function registerProjectTasksQueue(workflows: AppWorkflows): void {
  workflows.register(PROJECT_TASK_RUN_TASK_TYPE, new ProjectTaskRunHandler());
  workflows.register(PROJECT_REVIEW_INTAKE_TASK_TYPE, new ProjectReviewIntakeHandler());
}
