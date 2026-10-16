import {
  TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
  TEAMMATE_RUN_RECONCILIATION_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { TeammateContextCleanupHandler } from "./TeammateContextCleanupHandler";
import { TeammateRunReconciliationHandler } from "./TeammateRunReconciliationHandler";

export function registerTeammatesQueue(workflows: AppWorkflows): void {
  workflows.register(TEAMMATE_RUN_RECONCILIATION_TASK_TYPE, new TeammateRunReconciliationHandler());
  workflows.register(TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE, new TeammateContextCleanupHandler());
}
