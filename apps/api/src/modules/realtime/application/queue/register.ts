import { REALTIME_RECONCILIATION_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { RealtimeReconciliationHandler } from "./RealtimeReconciliationHandler";

export function registerRealtimeQueue(workflows: AppWorkflows): void {
  workflows.register(REALTIME_RECONCILIATION_TASK_TYPE, new RealtimeReconciliationHandler());
}
