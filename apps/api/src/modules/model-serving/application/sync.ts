import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { PENDING, type PollOutcome } from "@ngriffin_uk/polychat-ai-workflows";
import { TRANSITIONAL_DEPLOYMENT_STATUSES } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { toAssistantError } from "~/modules/model-governance/application/provider-errors";
import { accrueDeploymentCost } from "~/modules/model-governance/application/spend";

import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";
import { applyHostState, hostFor } from "./invocation";

const logger = getLogger({ prefix: "modules/model-serving/sync" });

const TRANSITIONAL = new Set(TRANSITIONAL_DEPLOYMENT_STATUSES);
const BILLABLE = new Set(["provisioning", "running", "updating"]);

async function retireRoute(repositories: RepositoryManager, deployment: ModelDeploymentRecord) {
  if (deployment.route_id) {
    await repositories.modelRoutes.setStatus(deployment.route_id, "retired");
  }
}

async function accrue(
  repositories: RepositoryManager,
  deployment: ModelDeploymentRecord,
): Promise<void> {
  const billedUntil = await accrueDeploymentCost(
    repositories,
    deployment,
    BILLABLE.has(deployment.status),
  );

  await repositories.modelDeployments.update(deployment.id, { billed_until: billedUntil });
}

export async function syncDeployment(
  repositories: RepositoryManager,
  deploymentId: string,
): Promise<PollOutcome> {
  const deployment = await repositories.modelDeployments.getById(deploymentId);

  if (!deployment || deployment.status === "deleted") {
    return { status: "success", message: "Nothing to sync" };
  }

  try {
    await accrue(repositories, deployment);

    const { host, hosted, model, adapters } = await hostFor(repositories, deployment);

    if (deployment.desired_state === "deleted") {
      if (hosted) {
        await host.delete(hosted);
      }

      await repositories.modelDeployments.update(deployment.id, {
        status: "deleted",
        hourly_usd: 0,
        last_checked_at: new Date().toISOString(),
      });
      await retireRoute(repositories, deployment);
      await repositories.audit.createRecord({
        workspaceId: deployment.workspace_id,
        actorUserId: null,
        action: "model_deployment.removed_from_provider",
        targetType: "model_deployment",
        targetId: deployment.id,
        metadata: { provider: deployment.provider, providerRef: deployment.provider_ref },
      });

      return { status: "success", message: "Deleted" };
    }

    const state = hosted
      ? await host.status(hosted)
      : await host.create({
          deploymentId: deployment.id,
          name: deployment.name,
          spec: deployment.spec,
          model,
          adapters,
        });
    const updated = await applyHostState(repositories, deployment, state);

    if (updated.status === "deleted") {
      await retireRoute(repositories, updated);
    }

    return TRANSITIONAL.has(updated.status)
      ? PENDING
      : { status: "success", message: updated.status };
  } catch (error) {
    const reason = getErrorMessage(toAssistantError(error), "Sync failed");

    logger.warn("Deployment sync failed", { deploymentId, error: reason });
    await repositories.modelDeployments.update(deployment.id, {
      failure_reason: reason,
      last_checked_at: new Date().toISOString(),
      ...(deployment.provider_ref ? {} : { status: "failed" as const }),
    });

    return deployment.provider_ref ? PENDING : { status: "error", message: reason };
  }
}
