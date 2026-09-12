import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export type DelegationExecutionRoute = "hosted" | "sandbox" | "machine";

export function resolveDelegationExecutionRoute(
  model: Pick<ModelConfigItem, "provider" | "runsOn" | "machineId"> | null | undefined,
): DelegationExecutionRoute {
  if (model?.provider === "polychat-sandbox") {
    return "sandbox";
  }

  if (model?.runsOn === "device" || model?.machineId) {
    return "machine";
  }

  return "hosted";
}

export function canRunDelegationOnMachine(
  model: ModelConfigItem | null | undefined,
): model is ModelConfigItem & { machineId: string } {
  return Boolean(
    model?.machineId &&
    model.agent?.capabilities.resumesSessions &&
    model.agent.capabilities.runsUnattended,
  );
}
