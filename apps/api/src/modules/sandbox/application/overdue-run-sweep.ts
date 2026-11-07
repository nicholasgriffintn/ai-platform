import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  SANDBOX_RUNS_CAPABILITY_ID,
  SANDBOX_TIMEOUT_MAX_SECONDS,
  type SandboxRunControl,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import type { IEnv } from "~/types";

import { failSandboxRun } from "./dispatch";
import { getRunCoordinatorControl } from "./run-coordinator";
import { parseSandboxRunData, type SandboxRunData } from "./run-data";

const logger = getLogger({ prefix: "services/apps/sandbox/overdue-run-sweep" });

const SWEEP_BATCH_SIZE = 50;
const SWEEP_GRACE_MS = 10 * 60 * 1000;

function isOverdue(run: SandboxRunData, control: SandboxRunControl | null, now: Date): boolean {
  if (control?.state === "paused" || control?.state === "inspection") {
    return false;
  }

  const startedAt = Date.parse(run.processingStartedAt ?? run.updatedAt);
  const controlledAt = control ? Date.parse(control.updatedAt) : Number.NaN;
  const lastActive = Math.max(startedAt, Number.isNaN(controlledAt) ? startedAt : controlledAt);
  const timeoutMs = (run.timeoutSeconds ?? SANDBOX_TIMEOUT_MAX_SECONDS) * 1000;

  return now.getTime() > lastActive + timeoutMs + SWEEP_GRACE_MS;
}

export async function sweepOverdueSandboxRuns(env: IEnv, now = new Date()): Promise<number> {
  const context = createServiceContext({ env });
  const records = await context.repositories
    .get(ActivityRepository)
    .listActiveActivitiesUpdatedBefore(
      SANDBOX_RUNS_CAPABILITY_ID,
      new Date(now.getTime() - SWEEP_GRACE_MS).toISOString(),
      SWEEP_BATCH_SIZE,
    );
  let settled = 0;

  for (const record of records) {
    const runData = parseSandboxRunData(safeParseJson(record.data));

    if (!runData || !record.group_id) {
      continue;
    }

    try {
      const control = await getRunCoordinatorControl(env, record.group_id);

      if (!isOverdue(runData, control, now)) {
        continue;
      }

      await failSandboxRun({
        env,
        context,
        message: {
          runId: record.group_id,
          recordId: record.id,
          userId: record.created_by_user_id,
        },
        runData,
        error: new Error("This run stopped responding and was ended after its time limit."),
      });
      settled += 1;
    } catch (error) {
      logger.warn("Could not settle an overdue sandbox run", { runId: record.group_id, error });
    }
  }

  return settled;
}
