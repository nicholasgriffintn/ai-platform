import { isMachineOnline, type ProjectTask } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { MachineRepository } from "~/modules/machines/infrastructure/MachineRepository";
import { findModelConfig } from "~/modules/models/application/resolve";
import {
  canRunUnattendedOnMachine,
  findModelReadinessProblem,
  resolveExecutionRoute,
} from "~/modules/models/domain/execution-route";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

export interface ExecutionRouteBlocker {
  reason: "machine_offline" | "missing_capability";
  detail: string;
}

export async function findExecutionRouteBlocker(
  context: ServiceContext,
  task: Pick<ProjectTask, "runner" | "projectId">,
  runnerIdentityUserId: number,
): Promise<ExecutionRouteBlocker | null> {
  const teammateId = task.runner?.teammateId;
  const teammate = teammateId
    ? await context.repositories.get(TeammateRepository).getTeammateById(teammateId)
    : null;
  const modelId = task.runner?.model ?? teammate?.model ?? null;

  if (!modelId) {
    return null;
  }

  const model = await findModelConfig(modelId, context.env, undefined, runnerIdentityUserId);

  if (!model) {
    return {
      reason: "missing_capability",
      detail: `The model ${teammate?.name ?? "this task"} runs on is no longer available. Choose another on its page.`,
    };
  }

  const readinessProblem = findModelReadinessProblem(model);

  if (readinessProblem) {
    return { reason: "missing_capability", detail: readinessProblem };
  }

  const route = resolveExecutionRoute(model);

  if (route === "sandbox") {
    const project = await context.repositories.get(WorkspaceRepository).getProject(task.projectId);

    return project?.coding_repository
      ? null
      : {
          reason: "missing_capability",
          detail:
            "This runs in the sandbox, which needs a repository connected in the project's settings.",
        };
  }

  if (route !== "machine") {
    return null;
  }

  if (!canRunUnattendedOnMachine(model)) {
    return {
      reason: "missing_capability",
      detail: "The agent on that machine cannot run unattended with a lasting session.",
    };
  }

  const [machines, owner] = await Promise.all([
    context.repositories.get(MachineRepository).listForUser(runnerIdentityUserId),
    context.repositories.get(UserRepository).getUserById(runnerIdentityUserId),
  ]);
  const machine = machines.find((candidate) => candidate.machineId === model.machineId);

  return machine && isMachineOnline(machine)
    ? null
    : {
        reason: "machine_offline",
        detail: `Waiting for ${owner?.name ?? "its owner"} to bring ${machine?.label ?? "their machine"} online. It starts by itself when Polychat on that machine reconnects.`,
      };
}
