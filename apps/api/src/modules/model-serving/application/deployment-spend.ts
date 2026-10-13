import { hostManifest } from "@ngriffin_uk/polychat-ai-model-providers";
import { estimateMonthlyHostingCost } from "@ngriffin_uk/polychat-library-model-registry";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { DeploymentSpendAction } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireHostingBudgetCompatibility } from "~/modules/model-governance/application/hosting-budgets";
import { preflightWorkspaceSpend } from "~/modules/model-governance/application/spend";
import { recordSpendRequest } from "~/modules/model-governance/application/spend-requests";
import { conflict, requireModelAction } from "~/modules/model-registry/application/access";

import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";

export async function authoriseDeploymentSpend(
  context: ServiceContext,
  deployment: ModelDeploymentRecord,
  action: DeploymentSpendAction,
  approved: boolean,
): Promise<string | null> {
  const access = await requireModelAction(context, deployment.workspace_id, "deploy");
  const host = hostManifest(deployment.provider, deployment.host);
  const current = deployment.spec.scaling;
  const next = action.action === "scale" ? action.scaling : current;
  const replicas =
    action.action === "resume"
      ? Math.max(host.scaleToZero ? 0 : 1, next.minReplicas)
      : Math.max(0, next.minReplicas - current.minReplicas, next.maxReplicas - current.maxReplicas);

  if (action.action === "scale" && replicas === 0) {
    return null;
  }

  await requireHostingBudgetCompatibility(
    context.repositories,
    deployment.workspace_id,
    deployment.project_id,
    host,
  );

  const hourly =
    host.hardware.find((item) => item.id === deployment.spec.target.hardware)?.hourlyUsd ??
    (deployment.hourly_usd !== null && deployment.hourly_usd > 0
      ? deployment.hourly_usd / Math.max(1, current.minReplicas)
      : null);
  const estimate = estimateMonthlyHostingCost({
    hourlyUsd: hourly,
    minReplicas: replicas,
    scaleToZero: true,
  });
  const preflight = await preflightWorkspaceSpend(
    context.repositories,
    deployment.workspace_id,
    deployment.project_id,
    estimate,
  );

  if (preflight.decision === "blocked") {
    throw conflict(preflight.reason ?? "This change would exceed the budget");
  }

  const isAuthorised = authorise("spend.authorise", {
    required: preflight.decision === "needs_approval",
    approved,
    canApprove: access.actions.has("approve"),
    separationOfDuties: access.separationOfDuties,
  }).allowed;

  if (!isAuthorised) {
    const request = await recordSpendRequest(context.repositories, {
      workspaceId: deployment.workspace_id,
      projectId: deployment.project_id,
      subjectType: "deployment",
      payload: { ...action, name: deployment.name },
      estimateUsd: estimate,
      reason: preflight.reason,
      requestedBy: access.userId,
    });

    return request.id;
  }

  return null;
}
