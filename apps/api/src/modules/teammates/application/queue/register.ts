import {
  TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
  TEAMMATE_RUN_RECONCILIATION_TASK_TYPE,
  WORK_TEAMMATE_WAKE_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { runDueStandups } from "~/modules/project-tasks/application/standups";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";
import { reviewWorkBudgets } from "~/modules/teammates/application/organisation";
import { scheduleWorkHeartbeats, watchStalledWakes } from "~/modules/teammates/application/wakes";

import { TeammateContextCleanupHandler } from "./TeammateContextCleanupHandler";
import { TeammateRunReconciliationHandler } from "./TeammateRunReconciliationHandler";
import { WorkTeammateWakeHandler } from "./WorkTeammateWakeHandler";

export function registerTeammatesQueue(workflows: AppWorkflows): void {
  workflows.register(TEAMMATE_RUN_RECONCILIATION_TASK_TYPE, new TeammateRunReconciliationHandler());
  workflows.register(TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE, new TeammateContextCleanupHandler());
  workflows.register(WORK_TEAMMATE_WAKE_TASK_TYPE, new WorkTeammateWakeHandler());
  workflows.every(
    SCHEDULES.WORK_RHYTHM,
    defineSchedule({
      name: "work-rhythm",
      run: async ({ env }) => {
        await reviewWorkBudgets(createServiceContext({ env }));
        await watchStalledWakes(env);
        await scheduleWorkHeartbeats(env);
        await runDueStandups(env);
      },
    }),
  );
}
