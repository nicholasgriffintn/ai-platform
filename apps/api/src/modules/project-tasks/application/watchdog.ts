import { isTerminalProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";
import { parseStoredTimestamp } from "@ngriffin_uk/polychat-utility-core";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import {
  describeWakeReason,
  listStaleWakes,
  settleWake,
} from "~/modules/teammates/application/wakes";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

import { escalateTask, teammateCaller } from "./work";

export async function escalateStalledWakes(env: IEnv, now = new Date()): Promise<number> {
  const context = createServiceContext({ env });
  const tasks = context.repositories.get(ProjectTaskRepository);
  let escalated = 0;

  for (const { employment, wake } of await listStaleWakes(context, now)) {
    const [touched, focus] = await Promise.all([
      tasks.hasTeammateTaskUpdatedSince(employment.workspaceId, employment.teammateId, wake.at),
      wake.taskId ? tasks.getTaskById(wake.taskId) : Promise.resolve(null),
    ]);

    await settleWake(context, employment, wake);

    if (
      touched ||
      !focus ||
      isTerminalProjectTaskStatus(focus.status) ||
      parseStoredTimestamp(focus.updatedAt) > parseStoredTimestamp(wake.at)
    ) {
      continue;
    }

    const responsible = await context.repositories
      .get(UserRepository)
      .getUserById(employment.responsibleUserId);

    if (!responsible) {
      continue;
    }

    const acting = createServiceContext({ env, user: responsible });
    const caller = await teammateCaller(acting, employment.teammateId);

    await escalateTask(
      acting,
      focus.projectId,
      focus.id,
      `${caller.author.name} woke for ${describeWakeReason(wake.reason)} and stopped without an update, a status change or a named blocker.`,
      caller,
    );
    escalated += 1;
  }

  return escalated;
}
