import { PENDING, type PollOutcome } from "@ngriffin_uk/polychat-ai-workflows";

import type { Repositories } from "~/infrastructure/database/repositories";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { ModelDeploymentRepository } from "~/modules/model-serving/infrastructure/ModelDeploymentRepository";

import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";
import { applyHostState, hostFor } from "./invocation";

export async function deleteProviderDeployment(
  repositories: Repositories,
  deployment: ModelDeploymentRecord,
): Promise<PollOutcome> {
  if (deployment.provider_ref) {
    const { host, hosted } = await hostFor(repositories, deployment);

    if (!hosted) {
      return PENDING;
    }

    const state = await host.status(hosted);

    await applyHostState(repositories, deployment, state);

    if (
      state.status === "pending" ||
      state.status === "provisioning" ||
      state.status === "updating"
    ) {
      await repositories
        .get(ModelDeploymentRepository)
        .update(deployment.id, { status: "deleting" });

      return PENDING;
    }

    const target = { ...hosted, providerRef: state.providerRef, desired: "deleted" as const };

    if (state.status !== "deleting") {
      await host.delete(target);
    }

    if (deployment.spec.shape === "dedicated") {
      const confirmed = await host.status(target);

      await applyHostState(repositories, deployment, confirmed);

      if (confirmed.status !== "deleted") {
        await repositories
          .get(ModelDeploymentRepository)
          .update(deployment.id, { status: "deleting" });

        return PENDING;
      }
    }
  }

  await repositories.get(ModelDeploymentRepository).update(deployment.id, {
    status: "deleted",
    hourly_usd: 0,
    failure_reason: null,
    last_checked_at: new Date().toISOString(),
  });

  if (deployment.route_id) {
    await repositories.get(ModelRouteRepository).setStatus(deployment.route_id, "retired");
  }

  await repositories.get(AuditRepository).createRecord({
    workspaceId: deployment.workspace_id,
    actorUserId: null,
    action: "model_deployment.removed_from_provider",
    targetType: "model_deployment",
    targetId: deployment.id,
    metadata: { provider: deployment.provider, providerRef: deployment.provider_ref },
  });

  return { status: "success", message: "Deleted" };
}
