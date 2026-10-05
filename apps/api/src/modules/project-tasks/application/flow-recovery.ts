import { findProjectFlowNode } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { IEnv } from "~/types";

import { completeProjectFlowWait } from "../domain/flow-machine";
import { driveProjectFlow, reloadFlowTask } from "./flow-execution";
import { enqueueProjectTaskRun, queueProjectTaskRun } from "./runner";

export async function recoverProjectFlows(env: IEnv, now = new Date()): Promise<void> {
  const base = createServiceContext({ env });
  const timers = await base.repositories.projectFlows.dueTimers(now.toISOString());

  for (const wait of timers) {
    const task = await reloadFlowTask(base, wait.taskId);
    const runner = await base.repositories.users.getUserById(
      task.runnerIdentityUserId ?? task.createdByUserId,
    );
    const node = findProjectFlowNode(task.flowSnapshot, wait.nodeId);

    if (!runner || node?.type !== "timer" || task.flowExecution.waitId !== wait.id) {
      continue;
    }

    const context = createServiceContext({ env, user: runner });

    try {
      const committed = await context.repositories.projectFlows.transition({
        task,
        execution: completeProjectFlowWait(task.flowExecution, node.next),
        actorUserId: runner.id,
        status: "backlog",
        kind: "resumed",
        resolve: {
          wait,
          values: {},
          digest: await sha256Hex(canonicalJson({ dueAt: wait.dueAt })),
        },
      });

      if (committed) {
        await driveProjectFlow(context, await reloadFlowTask(context, task.id));
      }
    } catch (error) {
      context.getLogger({ prefix: "project-flow-recovery" }).warn("Timer continuation is pending", {
        taskId: task.id,
        error: getErrorMessage(error),
      });
    }
  }

  const tasks = await base.repositories.projectFlows.resumableTasks();

  for (const task of tasks) {
    const runner = await base.repositories.users.getUserById(
      task.runnerIdentityUserId ?? task.createdByUserId,
    );

    if (!runner) {
      continue;
    }

    const context = createServiceContext({ env, user: runner });

    try {
      await requireProjectAccess(context, task.projectId);
      if (!task.flowExecution.waitId) {
        await driveProjectFlow(context, task);
      } else {
        const wait = await context.repositories.projectFlows.getWait(task.flowExecution.waitId);

        if (!wait || (wait.kind !== "agent" && wait.kind !== "function")) {
          continue;
        }

        if (
          task.status === "queued" &&
          wait.executionId === task.dispatchTaskId &&
          task.dispatchTaskId
        ) {
          await enqueueProjectTaskRun(
            context,
            task,
            runner.id,
            task.dispatchTaskId,
            task.conversationId,
          );
        } else if (wait.status === "pending") {
          await queueProjectTaskRun({ context, task, runnerIdentityUserId: runner.id });
        }
      }
    } catch (error) {
      context.getLogger({ prefix: "project-flow-recovery" }).warn("Flow continuation is pending", {
        taskId: task.id,
        error: getErrorMessage(error),
      });
    }
  }
}
