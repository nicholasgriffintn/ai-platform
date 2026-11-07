import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";

import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { readTaskWorkflow } from "~/modules/queue/infrastructure/workflow-instances";
import type { IEnv } from "~/types";

import { TaskService } from "./TaskService";

const logger = getLogger({ prefix: "services/tasks/scheduled" });

const SETTLED_TASK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SETTLED_TASK_PURGE_LIMIT = 500;
const DISPATCH_RECOVERY_DELAY_MS = 5 * 60 * 1000;
const WORKFLOW_CHECK_DELAY_MS = 15 * 60 * 1000;
const WORKFLOW_CHECK_LIMIT = 100;
const WORKFLOW_CHECK_CONCURRENCY = 6;

export async function redispatchPendingTasks(env: IEnv, now = new Date()): Promise<number> {
  const taskService = new TaskService(env, new TaskRepository(env));
  const dispatched = await taskService.dispatchPendingTasks(
    new Date(now.getTime() - DISPATCH_RECOVERY_DELAY_MS),
  );

  if (dispatched > 0) {
    logger.info("Started runs for pending tasks", { dispatched });
  }

  return dispatched;
}

export async function recoverErroredWorkflowTasks(env: IEnv, now = new Date()): Promise<number> {
  const binding = env.TASK_WORKFLOW;

  if (!binding) {
    return 0;
  }

  const repository = new TaskRepository(env);
  const tasks = await repository.sampleDueWorkflowTasks(
    new Date(now.getTime() - WORKFLOW_CHECK_DELAY_MS),
    WORKFLOW_CHECK_LIMIT,
  );
  const checks = await mapWithConcurrency(
    tasks.flatMap((task) =>
      task.workflow_instance_id ? [{ task, instanceId: task.workflow_instance_id }] : [],
    ),
    WORKFLOW_CHECK_CONCURRENCY,
    async (check) => ({ ...check, workflow: await readTaskWorkflow(binding, check.instanceId) }),
  );
  let recovered = 0;

  for (const { task, instanceId, workflow } of checks) {
    if (workflow.status !== "errored" && workflow.status !== "terminated") {
      continue;
    }

    const reason = `Workflow run ${workflow.status}${workflow.error ? `: ${workflow.error}` : ""}`;

    await repository.failRunningTaskExecutions(task.id, reason);

    if (!(await repository.requeueErroredWorkflowTask(task.id, instanceId))) {
      await repository.failOpenTask(task.id, reason);
    }

    recovered += 1;
  }

  if (recovered > 0) {
    logger.warn("Recovered tasks whose workflow run stopped", { recovered });
  }

  return recovered;
}

export async function purgeSettledTasks(env: IEnv, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SETTLED_TASK_RETENTION_MS);
  const deleted = await new TaskRepository(env).deleteSettledTasksBefore(
    cutoff,
    SETTLED_TASK_PURGE_LIMIT,
  );

  if (deleted > 0) {
    logger.info("Purged settled tasks", { deleted, cutoff: cutoff.toISOString() });
  }

  return deleted;
}
