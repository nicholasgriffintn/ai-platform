import {
  isMachineOnline,
  machineCapacitySchema,
  type AgentRuntimeVendor,
  type MachineRuntime,
} from "@ngriffin_uk/polychat-schemas";
import { sortCopy } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { machineModelId } from "~/modules/machines/domain/model-id";
import { MachineRepository } from "~/modules/machines/infrastructure/MachineRepository";
import type { StoredMachine } from "~/modules/machines/infrastructure/MachineRepository";
import { findModelConfig } from "~/modules/models/application/resolve";
import { resolveExecutionRoute } from "~/modules/models/domain/execution-route";

import { callMachineRun } from "./runs";

const WORK_AGENT_PREFERENCE: readonly AgentRuntimeVendor[] = ["claude-code", "codex"];

function subscriptionAgent(runtime: MachineRuntime, vendor: AgentRuntimeVendor): boolean {
  return (
    runtime.kind === "agent" &&
    runtime.vendor === vendor &&
    runtime.supportsSessions &&
    runtime.readiness.state === "ready" &&
    runtime.readiness.billing === "subscription"
  );
}

function machineAgentModel(machine: StoredMachine): string | null {
  if (!isMachineOnline(machine) || !machine.capabilities.includes("agent-run")) {
    return null;
  }

  for (const vendor of WORK_AGENT_PREFERENCE) {
    if (machine.runtimes.some((runtime) => subscriptionAgent(runtime, vendor))) {
      return machineModelId({ machineId: machine.machineId, vendor, nativeId: vendor });
    }
  }

  return null;
}

async function hasCapacity(context: ServiceContext, machineId: string): Promise<boolean> {
  const response = await callMachineRun(context, machineId, "/capacity").catch(() => null);
  const capacity = response?.ok ? machineCapacitySchema.safeParse(await response.json()) : null;

  return capacity?.success === true && capacity.data.available > 0;
}

export async function chooseWorkMachineModel(
  context: ServiceContext,
  params: { workspaceId: string; runnerIdentityUserId: number; modelId: string | null },
): Promise<string | null> {
  if (params.modelId) {
    const model = await findModelConfig(
      params.modelId,
      context.env,
      undefined,
      params.runnerIdentityUserId,
    );

    if (model && resolveExecutionRoute(model) !== "hosted") {
      return null;
    }
  }

  const shared = await context.repositories
    .get(MachineRepository)
    .listSharedInWorkspace(params.workspaceId);
  const ordered = sortCopy(
    shared,
    (left, right) =>
      Number(right.userId === params.runnerIdentityUserId) -
      Number(left.userId === params.runnerIdentityUserId),
  );

  for (const machine of ordered) {
    const model = machineAgentModel(machine);

    if (model && (await hasCapacity(context, machine.machineId))) {
      return model;
    }
  }

  return null;
}
