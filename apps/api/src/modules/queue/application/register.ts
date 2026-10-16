import { SCHEDULES } from "~/config/schedules";

import {
  purgeSettledTasks,
  recoverFailedDurableTasks,
  redispatchPendingTasks,
} from "./scheduledTasks";
import { defineSchedule, type AppWorkflows } from "./workflows";

export function registerQueueMaintenance(workflows: AppWorkflows): void {
  workflows.always(
    defineSchedule({
      name: "task-recovery",
      run: async ({ env }) => {
        await recoverFailedDurableTasks(env);
        await redispatchPendingTasks(env);
      },
    }),
  );

  workflows.every(
    SCHEDULES.RECIPE_EXECUTION,
    defineSchedule({
      name: "settled-task-purge",
      run: async ({ env }) => {
        await purgeSettledTasks(env);
      },
    }),
  );
}
