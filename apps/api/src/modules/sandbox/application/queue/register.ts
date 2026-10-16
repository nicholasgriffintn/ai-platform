import { SANDBOX_RUN_DISPATCH_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { SandboxRunDispatchHandler } from "./SandboxRunDispatchHandler";

export function registerSandboxQueue(workflows: AppWorkflows): void {
  workflows.register(SANDBOX_RUN_DISPATCH_TASK_TYPE, new SandboxRunDispatchHandler());
}
