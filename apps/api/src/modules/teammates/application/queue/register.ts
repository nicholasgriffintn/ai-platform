import {
  TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
  TEAMMATE_RUN_RECONCILIATION_TASK_TYPE,
  WORK_TEAMMATE_WAKE_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";
import { runWorkRhythm } from "~/modules/teammates/application/wakes";

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
      run: ({ env }) => runWorkRhythm(env),
    }),
  );
}
