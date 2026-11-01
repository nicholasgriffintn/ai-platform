import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { AdminTaskWorkflow } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { IEnv } from "~/types";

type TaskWorkflowBinding = NonNullable<IEnv["TASK_WORKFLOW"]>;

const logger = getLogger({ prefix: "queue/workflow-instances" });
const SETTLED_STATUSES = new Set(["complete", "errored", "terminated"]);

export async function readTaskWorkflow(
  binding: TaskWorkflowBinding,
  instanceId: string,
): Promise<AdminTaskWorkflow> {
  try {
    const { status, error } = await (await binding.get(instanceId)).status();

    return {
      instance_id: instanceId,
      status,
      error: error ? `${error.name}: ${error.message}` : null,
    };
  } catch (error) {
    return { instance_id: instanceId, status: "unavailable", error: getErrorMessage(error) };
  }
}

export async function terminateTaskWorkflow(
  binding: TaskWorkflowBinding,
  instanceId: string,
): Promise<void> {
  try {
    const instance = await binding.get(instanceId);

    if (!SETTLED_STATUSES.has((await instance.status()).status)) {
      await instance.terminate();
    }
  } catch (error) {
    logger.warn("Task workflow could not be terminated", {
      instanceId,
      error: getErrorMessage(error),
    });
  }
}

export async function restartTaskWorkflow(
  binding: TaskWorkflowBinding,
  instanceId: string,
  fromStep: string | null,
): Promise<boolean> {
  try {
    await (
      await binding.get(instanceId)
    ).restart(fromStep ? { from: { name: fromStep } } : undefined);

    return true;
  } catch (error) {
    logger.error("Task workflow could not be restarted", {
      instanceId,
      fromStep,
      error: getErrorMessage(error),
    });

    return false;
  }
}
