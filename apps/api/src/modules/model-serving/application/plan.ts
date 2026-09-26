import { listProviderManifests } from "@ngriffin_uk/polychat-ai-model-providers";
import {
  estimateSizing,
  resolveDeploymentOptions,
  type ResolverModel,
} from "@ngriffin_uk/polychat-library-model-registry";
import type {
  DeploymentPlan,
  DeploymentPlanRequest,
  ModelProviderId,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { workspaceHubClient } from "~/modules/model-governance/application/connections";
import {
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "~/modules/model-registry/application/access";
import { weightsLocation, weightsPlacement } from "~/modules/model-registry/application/handles";
import { evaluateCandidateRoute } from "~/modules/model-registry/application/policies";
import { loadRegistryScope } from "~/modules/model-registry/application/scope";

const INFERENCE_PROVIDER_IDS: Record<string, ModelProviderId> = {
  together: "together",
  "fireworks-ai": "fireworks",
  nebius: "nebius",
};

export interface NormalisedTarget {
  baseVersionId: string;
  adapterVersionIds: string[];
}

export async function normaliseTarget(
  repositories: RepositoryManager,
  workspaceId: string,
  versionId: string,
  adapterVersionIds: readonly string[],
): Promise<NormalisedTarget> {
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);
  const asset = version
    ? await repositories.modelAssets.getAsset(workspaceId, version.asset_id)
    : null;

  if (!version || !asset) {
    throw notFound("Model version");
  }

  if (asset.kind !== "adapter") {
    return { baseVersionId: versionId, adapterVersionIds: [...adapterVersionIds] };
  }

  const base = (await repositories.modelAssets.listLineage(workspaceId)).find(
    (edge) => edge.toVersionId === versionId && edge.relation === "adapter_of",
  );

  if (!base) {
    throw notFound("Base model for this adapter");
  }

  return {
    baseVersionId: base.fromVersionId,
    adapterVersionIds: [versionId, ...adapterVersionIds.filter((id) => id !== versionId)],
  };
}

async function servedCatalogue(
  repositories: RepositoryManager,
  workspaceId: string,
  repo: string,
  revision: string,
): Promise<Set<string>> {
  try {
    const info = await (
      await workspaceHubClient(repositories, workspaceId)
    ).getRepoInfo({
      kind: "model",
      repo,
      revision,
    });
    const live = info.inferenceProviders.filter((provider) => provider.status === "live");
    const catalogue = new Set<string>();

    if (live.length > 0) {
      catalogue.add(`huggingface:${repo}`);
    }

    for (const provider of live) {
      const id = INFERENCE_PROVIDER_IDS[provider.provider];

      if (id) {
        catalogue.add(`${id}:${repo}`);
      }
    }

    return catalogue;
  } catch {
    return new Set();
  }
}

export async function planDeployment(
  context: ServiceContext,
  workspaceId: string,
  request: DeploymentPlanRequest,
): Promise<DeploymentPlan> {
  await requireModelAction(context, workspaceId, "view");

  const repositories = context.repositories;
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const target = await normaliseTarget(
    repositories,
    workspaceId,
    request.versionId,
    request.adapterVersionIds,
  );
  const scope = await loadRegistryScope(repositories, workspaceId, projectId, {
    versionIds: [target.baseVersionId, ...target.adapterVersionIds],
  });
  const base = scope.versions.find((version) => version.id === target.baseVersionId);
  const baseAsset = base ? scope.assets.get(base.asset_id) : undefined;

  if (!base || !baseAsset) {
    throw notFound("Model version");
  }

  const toResolverModel = (versionId: string): ResolverModel => {
    const version = scope.versions.find((item) => item.id === versionId);
    const asset = version ? scope.assets.get(version.asset_id) : undefined;

    return {
      kind: asset?.kind === "adapter" ? "adapter" : "model",
      placement: weightsPlacement(asset && version ? weightsLocation(asset, version) : null),
      modelType: version?.attributes.architecture?.modelType ?? null,
      parameterCount: version?.attributes.parameterCount ?? null,
    };
  };

  const model = toResolverModel(base.id);
  const connections = await repositories.modelConnections.listConnections(workspaceId);
  const location = weightsLocation(baseAsset, base);
  const catalogue =
    location?.kind === "hub"
      ? await servedCatalogue(repositories, workspaceId, location.repo, location.revision)
      : new Set<string>();
  const sizing = estimateSizing({
    parameterCount: base.attributes.parameterCount,
    architecture: base.attributes.architecture,
    quantisation: request.quantisation,
    contextLength: request.contextLength,
    concurrency: request.concurrency,
  });

  return {
    sizing,
    options: resolveDeploymentOptions({
      manifests: listProviderManifests(),
      connections: connections.map((connection) => ({
        provider: connection.provider,
        capabilities: connection.capabilities,
      })),
      model,
      adapters: target.adapterVersionIds.map(toResolverModel),
      sizing,
      catalogue,
      verdictFor: (candidate) =>
        evaluateCandidateRoute(scope.stack, baseAsset, base, scope.evidence, {
          region: candidate.region?.jurisdiction ?? "unknown",
          weightsVerified: candidate.host.weightsVerified,
          jurisdiction: candidate.region?.jurisdiction ?? null,
          retention: candidate.host.retention,
        }),
    }),
  };
}
