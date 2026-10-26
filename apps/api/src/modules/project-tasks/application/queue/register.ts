import {
  PROJECT_REVIEW_INTAKE_TASK_TYPE,
  PROJECT_TASK_RUN_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";
import { runEachSettled } from "@ngriffin_uk/polychat-utility-core";

import { SCHEDULES } from "~/config/schedules";
import { runLeadRoutines } from "~/modules/project-tasks/application/lead-routines";
import { ProjectReviewIntakeHandler } from "~/modules/project-tasks/application/review-intake";
import { runDueStandups } from "~/modules/project-tasks/application/standups";
import { escalateStalledWakes } from "~/modules/project-tasks/application/watchdog";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { ProjectTaskRunHandler } from "./ProjectTaskRunHandler";

export function registerProjectTasksQueue(workflows: AppWorkflows): void {
  workflows.register(PROJECT_TASK_RUN_TASK_TYPE, new ProjectTaskRunHandler());
  workflows.register(PROJECT_REVIEW_INTAKE_TASK_TYPE, new ProjectReviewIntakeHandler());
  workflows.every(
    SCHEDULES.WORK_RHYTHM,
    defineSchedule({
      name: "work-task-rhythm",
      run: ({ env }) =>
        runEachSettled([escalateStalledWakes, runDueStandups, runLeadRoutines], (step) =>
          step(env),
        ),
    }),
  );
}
