import { isMachineOnline, type ProjectTask } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { MachineRepository } from "~/modules/machines/infrastructure/MachineRepository";
import { findModelConfig } from "~/modules/models/application/resolve";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

export async function describeOfflineMachine(
  context: ServiceContext,
  task: Pick<ProjectTask, "runner">,
  runnerIdentityUserId: number,
): Promise<string | null> {
  const teammateId = task.runner?.teammateId;
  const teammate = teammateId
    ? await context.repositories.get(TeammateRepository).getTeammateById(teammateId)
    : null;
  const modelId = task.runner?.model ?? teammate?.model ?? null;

  if (!modelId) {
    return null;
  }

  const model = await findModelConfig(modelId, context.env, undefined, runnerIdentityUserId);

  if (!model?.machineId) {
    return null;
  }

  const [machines, owner] = await Promise.all([
    context.repositories.get(MachineRepository).listForUser(runnerIdentityUserId),
    context.repositories.get(UserRepository).getUserById(runnerIdentityUserId),
  ]);
  const machine = machines.find((candidate) => candidate.machineId === model.machineId);

  if (machine && isMachineOnline(machine)) {
    return null;
  }

  return `Waiting for ${owner?.name ?? "its owner"} to bring ${machine?.label ?? "their machine"} online. It starts by itself when Polychat on that machine reconnects.`;
}
