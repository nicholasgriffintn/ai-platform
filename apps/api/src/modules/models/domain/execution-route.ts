import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export type ExecutionRoute = "hosted" | "sandbox" | "machine";

export function resolveExecutionRoute(
  model: Pick<ModelConfigItem, "provider" | "runsOn" | "machineId"> | null | undefined,
): ExecutionRoute {
  if (model?.provider === "polychat-sandbox") {
    return "sandbox";
  }

  if (model?.runsOn === "device" || model?.machineId) {
    return "machine";
  }

  return "hosted";
}

export function canRunUnattendedOnMachine(
  model: ModelConfigItem | null | undefined,
): model is ModelConfigItem & { machineId: string } {
  return (
    typeof model?.machineId === "string" &&
    model.machineId.length > 0 &&
    model.agent?.capabilities.resumesSessions === true &&
    model.agent.capabilities.runsUnattended === true
  );
}

export function findModelReadinessProblem(
  model: Pick<ModelConfigItem, "readiness"> | null | undefined,
  now = Date.now(),
): string | null {
  const readiness = model?.readiness;

  if (!readiness || (readiness.state === "ready" && Date.parse(readiness.expiresAt) > now)) {
    return null;
  }

  return readiness.reason || "The provider this runs on is not ready.";
}
