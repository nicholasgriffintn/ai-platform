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
  return (
    typeof model?.machineId === "string" &&
    model.machineId.length > 0 &&
    model.agent?.capabilities.resumesSessions === true &&
    model.agent.capabilities.runsUnattended === true
  );
}
