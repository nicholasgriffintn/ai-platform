import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { PENDING, type PollOutcome } from "@ngriffin_uk/polychat-ai-workflows";
import { TRANSITIONAL_DEPLOYMENT_STATUSES } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { assertProviderCreationPending } from "~/modules/model-governance/application/provider-creation";
import { toAssistantError } from "~/modules/model-governance/application/provider-errors";
import { accrueDeploymentCost } from "~/modules/model-governance/application/spend";
import { requireUsableVersion } from "~/modules/model-registry/application/scope";

import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";
import { deleteProviderDeployment } from "./deletion";
import { isDeploymentBillable } from "./deployment-state";
import { applyHostState, hostFor } from "./invocation";

const logger = getLogger({ prefix: "modules/model-serving/sync" });

const TRANSITIONAL = new Set(TRANSITIONAL_DEPLOYMENT_STATUSES);

async function retireRoute(repositories: RepositoryManager, deployment: ModelDeploymentRecord) {
  if (deployment.route_id) {
    await repositories.modelRoutes.setStatus(deployment.route_id, "retired");
  }
}

async function accrue(
  repositories: RepositoryManager,
  deployment: ModelDeploymentRecord,
): Promise<void> {
  await accrueDeploymentCost(repositories, deployment, isDeploymentBillable(deployment));
}

export async function syncDeployment(
  repositories: RepositoryManager,
  deploymentId: string,
): Promise<PollOutcome> {
  let deployment = await repositories.modelDeployments.getById(deploymentId);

  if (!deployment || deployment.status === "deleted") {
    return { status: "success", message: "Nothing to sync" };
  }

  try {
    if (!deployment.provider_ref && deployment.provisioning_started_at) {
      assertProviderCreationPending(deployment.provisioning_started_at);

      return PENDING;
    }

    await accrue(repositories, deployment);

    if (!deployment.provider_ref && deployment.desired_state === "paused") {
      await repositories.modelDeployments.update(deployment.id, {
        status: "paused",
        hourly_usd: 0,
        failure_reason: null,
        last_checked_at: new Date().toISOString(),
      });

      return { status: "success", message: "Paused before provisioning" };
    }

    if (deployment.desired_state === "deleted") {
      return await deleteProviderDeployment(repositories, deployment);
    }

    if (!deployment.provider_ref) {
      for (const versionId of new Set([
        deployment.spec.versionId,
        ...deployment.spec.adapterVersionIds,
      ])) {
        await requireUsableVersion(
          repositories,
          deployment.workspace_id,
          deployment.project_id,
          versionId,
          "Deployment input",
        );
      }
    }

    const { host, hosted, model, adapters } = await hostFor(repositories, deployment);

    if (!hosted) {
      const claimed = await repositories.modelDeployments.claimProvisioning(deployment.id);

      if (!claimed) {
        return PENDING;
      }

      deployment = claimed;
      const state = await host.create({
        deploymentId: deployment.id,
        name: deployment.name,
        spec: deployment.spec,
        model,
        adapters,
      });

      await applyHostState(repositories, deployment, state);

      return PENDING;
    }

    let state = await host.status(hosted);

    if (
      deployment.desired_state === "paused" &&
      state.status !== "paused" &&
      state.status !== "deleted"
    ) {
      state = await host.pause(hosted);
    }

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
