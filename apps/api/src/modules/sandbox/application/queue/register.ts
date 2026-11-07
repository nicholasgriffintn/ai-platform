import { SANDBOX_RUN_DISPATCH_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { sweepOverdueSandboxRuns } from "../overdue-run-sweep";
import { SandboxRunDispatchHandler } from "./SandboxRunDispatchHandler";

export function registerSandboxQueue(workflows: AppWorkflows): void {
  workflows.register(SANDBOX_RUN_DISPATCH_TASK_TYPE, new SandboxRunDispatchHandler());

  workflows.every(
    SCHEDULES.SANDBOX_RUN_SWEEP,
    defineSchedule({
      name: "overdue-sandbox-runs",
      run: async ({ env }) => {
        await sweepOverdueSandboxRuns(env);
      },
    }),
  );
}
