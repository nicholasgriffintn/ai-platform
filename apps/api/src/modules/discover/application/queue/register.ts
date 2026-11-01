import { DISCOVER_JOB_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { discoverJob } from "./discover-job";

export function registerDiscoverQueue(workflows: AppWorkflows): void {
  workflows.on(DISCOVER_JOB_TASK_TYPE, discoverJob);
}
