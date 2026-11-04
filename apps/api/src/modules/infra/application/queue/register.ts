import { INFRA_RECONCILIATION_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { checkD1WriteBreaker } from "../write-breaker";
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

  workflows.every(
    SCHEDULES.D1_WRITE_BREAKER,
    defineSchedule({
      name: "d1-write-breaker",
      run: async ({ env }) => {
        await checkD1WriteBreaker(env);
      },
    }),
  );
}
