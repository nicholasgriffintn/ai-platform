import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";

export function isDeploymentBillable(deployment: Pick<ModelDeploymentRecord, "status">): boolean {
  return (
    deployment.status === "provisioning" ||
    deployment.status === "running" ||
    deployment.status === "updating" ||
    deployment.status === "deleting"
  );
}

const INVOCABLE_STATUSES = new Set<ModelDeploymentRecord["status"]>([
  "running",
  "scaled_to_zero",
  "updating",
]);

export function isDeploymentInvocable(
  deployment: Pick<ModelDeploymentRecord, "status" | "desired_state">,
): boolean {
  return deployment.desired_state === "running" && INVOCABLE_STATUSES.has(deployment.status);
}
