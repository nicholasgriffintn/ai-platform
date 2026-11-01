import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { sleep } from "@ngriffin_uk/polychat-utility-core";

import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { restartTaskWorkflow } from "~/modules/queue/infrastructure/workflow-instances";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "queue/local-recovery" });
const RELOAD_SETTLE_MS = 15_000;
let recovery: Promise<void> | null = null;

async function restartInterruptedRuns(env: IEnv, startedAt: Date): Promise<void> {
  const binding = env.TASK_WORKFLOW;

  if (!binding) {
    return;
  }

  const repository = new TaskRepository(env);
  const tasks = await repository.listOpenWorkflowTasksUpdatedBefore(startedAt);
  let restarted = 0;

  for (const task of tasks) {
    if (!task.workflow_instance_id) {
      continue;
    }

    const step = await repository.findRunningExecutionStep(task.id);

    await repository.failRunningTaskExecutions(
      task.id,
      "Stopped when the local dev server reloaded.",
    );

    if (await restartTaskWorkflow(binding, task.workflow_instance_id, step)) {
      restarted += 1;
    }
  }

  if (restarted > 0) {
    logger.info("Restarted workflow runs interrupted by a dev server reload", { restarted });
  }
}

async function restartOnceSettled(env: IEnv): Promise<void> {
  const startedAt = new Date();

  await sleep(RELOAD_SETTLE_MS);
  await restartInterruptedRuns(env, startedAt);
}

export function recoverInterruptedLocalRuns(env: IEnv): Promise<void> {
  recovery ??= restartOnceSettled(env).catch((error: unknown) => {
    logger.error("Interrupted workflow runs could not be recovered", { error });
  });

  return recovery;
}
