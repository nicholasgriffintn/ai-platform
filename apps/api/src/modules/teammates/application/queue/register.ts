import {
  TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
  TEAMMATE_RUN_RECONCILIATION_TASK_TYPE,
  TEAMMATE_TRUST_CHECK_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { scheduleTeammateTrustCheck } from "../trust-check/schedule";
import { teammateTrustCheck } from "./teammate-trust-check";
import { TeammateContextCleanupHandler } from "./TeammateContextCleanupHandler";
import { TeammateRunReconciliationHandler } from "./TeammateRunReconciliationHandler";

export function registerTeammatesQueue(workflows: AppWorkflows): void {
  workflows.register(TEAMMATE_RUN_RECONCILIATION_TASK_TYPE, new TeammateRunReconciliationHandler());
  workflows.register(TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE, new TeammateContextCleanupHandler());
  workflows.on(TEAMMATE_TRUST_CHECK_TASK_TYPE, teammateTrustCheck);
  workflows.every(
    SCHEDULES.TEAMMATE_TRUST_CHECK,
    defineSchedule({
      name: "teammate-trust-check",
      run: ({ env }) => scheduleTeammateTrustCheck(env),
    }),
  );
}
