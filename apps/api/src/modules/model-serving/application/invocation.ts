import {
  type ChatInvocation,
  type ChatInvocationResult,
  createHost,
  type Host,
  type HostDeploymentState,
  type HostedDeployment,
  type ModelHandle,
} from "@ngriffin_uk/polychat-ai-model-providers";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { resolveProviderContext } from "~/modules/model-governance/application/connections";
import { withProviderErrors } from "~/modules/model-governance/application/provider-errors";
import { conflict } from "~/modules/model-registry/application/access";
import { buildModelHandle } from "~/modules/model-registry/application/handles";

import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";

const INVOCABLE_STATUSES = new Set(["running", "scaled_to_zero", "updating"]);

export async function hostFor(
  repositories: RepositoryManager,
  deployment: ModelDeploymentRecord,
): Promise<{
  host: Host;
  model: ModelHandle;
  adapters: ModelHandle[];
  hosted: HostedDeployment | null;
}> {
  const context = await resolveProviderContext(
    repositories,
    deployment.workspace_id,
    deployment.provider,
  );
  const host = createHost(deployment.provider, deployment.host, context);
  const model = await buildModelHandle(
    repositories,
    deployment.workspace_id,
    deployment.spec.versionId,
  );
  const adapters = await Promise.all(
    deployment.spec.adapterVersionIds.map((id) =>
      buildModelHandle(repositories, deployment.workspace_id, id),
    ),
  );

  return {
    host,
    model,
    adapters,
    hosted: deployment.provider_ref
      ? {
          providerRef: deployment.provider_ref,
          spec: deployment.spec,
          model,
          adapters,
          desired: deployment.desired_state === "paused" ? "paused" : "running",
        }
      : null,
  };
}

export async function applyHostState(
  repositories: RepositoryManager,
  deployment: ModelDeploymentRecord,
  state: HostDeploymentState,
): Promise<ModelDeploymentRecord> {
  const changes = {
    status: state.status,
    provider_ref: state.providerRef,
    region: state.region ?? deployment.region,
    hourly_usd: state.hourlyUsd ?? deployment.hourly_usd,
    failure_reason: state.failureReason,
    last_checked_at: new Date().toISOString(),
  };

  await repositories.modelDeployments.update(deployment.id, changes);

  return { ...deployment, ...changes };
}

export async function runHostAction(
  repositories: RepositoryManager,
  deployment: ModelDeploymentRecord,
  action: (host: Host, hosted: HostedDeployment) => Promise<HostDeploymentState>,
): Promise<ModelDeploymentRecord> {
  const { host, hosted } = await hostFor(repositories, deployment);

  if (!hosted) {
    throw conflict("The deployment has not been created with the provider yet");
  }

  return applyHostState(
    repositories,
    deployment,
    await withProviderErrors(() => action(host, hosted)),
  );
}

export async function invokeDeployment(
  repositories: RepositoryManager,
  deployment: ModelDeploymentRecord,
  request: ChatInvocation,
): Promise<ChatInvocationResult> {
  if (deployment.desired_state !== "running" || !INVOCABLE_STATUSES.has(deployment.status)) {
    throw conflict(`Deployment ${deployment.name} is ${deployment.status.replace(/_/g, " ")}`);
  }

  const { host, hosted } = await hostFor(repositories, deployment);

  if (!hosted) {
    throw conflict(`Deployment ${deployment.name} is still being created`);
  }

  return withProviderErrors(() => host.invoke(hosted, request));
}
