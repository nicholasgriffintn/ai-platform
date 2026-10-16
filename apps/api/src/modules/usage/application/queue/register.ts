import { USAGE_ROLLUP_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { usageRollup } from "./usage-rollup";

export function registerUsageQueue(workflows: AppWorkflows): void {
  workflows.on(USAGE_ROLLUP_TASK_TYPE, usageRollup);
}
