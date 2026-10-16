import { INFRA_RECONCILIATION_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { InfraReconciliationHandler } from "./InfraReconciliationHandler";
import { scheduleInfraReconciliation } from "./schedule";

export function registerInfraQueue(workflows: AppWorkflows): void {
  workflows.register(INFRA_RECONCILIATION_TASK_TYPE, new InfraReconciliationHandler());

  workflows.every(
    SCHEDULES.INFRA_RECONCILIATION,
    defineSchedule({
      name: "infra-reconciliation",
      run: ({ env }) => scheduleInfraReconciliation(env),
    }),
  );
}
