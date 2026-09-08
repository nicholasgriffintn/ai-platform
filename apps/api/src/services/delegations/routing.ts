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
