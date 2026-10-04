import {
  assessModificationCompute,
  buildMlBom,
  buildSpdxAiBom,
  collectAncestry,
  renderModelCard,
} from "@ngriffin_uk/polychat-library-model-registry";
import type {
  BomFormat,
  LineageEdge,
  ModelInventoryItem,
  TrainingContentSummary,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { toDatasetProfile } from "~/modules/model-datasets/application/datasets";
import { toEvalRun } from "~/modules/model-evaluation/application/mappers";
import { notFound, requireModelAction } from "~/modules/model-registry/application/access";
import {
  toModelAsset,
  toModelDecision,
  toModelEvidence,
  toModelFile,
  toModelRoute,
  toModelVersion,
} from "~/modules/model-registry/application/mappers";
import { loadRegistryScope, versionStanding } from "~/modules/model-registry/application/scope";

async function requireVersion(
  repositories: RepositoryManager,
  workspaceId: string,
  versionId: string,
) {
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);
  const asset = version
    ? await repositories.modelAssets.getAsset(workspaceId, version.asset_id)
    : null;

  if (!version || !asset) {
    throw notFound("Model version");
  }

  return { version, asset };
}

async function bomInput(
  repositories: RepositoryManager,
  workspaceId: string,
  versionId: string,
  routeId?: string,
) {
  const { version, asset } = await requireVersion(repositories, workspaceId, versionId);
  const route = routeId ? await repositories.modelRoutes.getRoute(workspaceId, routeId) : null;

  if (routeId && (!route || route.version_id !== versionId)) {
    throw notFound("Route");
  }

  const lineage = collectAncestry(
    await repositories.modelAssets.listLineage(workspaceId),
    versionId,
  );
  const ancestorVersions = await repositories.modelAssets.listVersions(workspaceId, [
    ...new Set(lineage.map((edge) => edge.fromVersionId)),
  ]);
  const ancestors = await Promise.all(
    ancestorVersions.map(async (ancestor) => {
      const ancestorAsset = await repositories.modelAssets.getAsset(workspaceId, ancestor.asset_id);

      return ancestorAsset
        ? {
            asset: toModelAsset(ancestorAsset),
            version: toModelVersion(ancestor),
            files: (await repositories.modelAssets.listFiles(ancestor.id)).map(toModelFile),
          }
        : null;
    }),
  );
  const [files, evidence, decisions, evalRuns] = await Promise.all([
    repositories.modelAssets.listFiles(versionId),
    repositories.modelGovernance.listEvidence([versionId]),
    repositories.modelGovernance.listDecisions(workspaceId, { versionIds: [versionId] }),
    repositories.modelEvals.listRuns({ versionIds: [versionId], limit: 20 }),
  ]);

  return {
    serialNumber: generateId(),
    generatedAt: new Date().toISOString(),
    subject: {
      asset: toModelAsset(asset),
      version: toModelVersion(version),
      files: files.map(toModelFile),
    },
    ancestors: ancestors.filter((ancestor) => ancestor !== null),
    lineage,
    evidence: evidence
      .map(toModelEvidence)
      .filter((item) => item.routeId === null || item.routeId === (routeId ?? null)),
    decisions: decisions
      .map(toModelDecision)
      .filter((decision) => decision.routeId === null || decision.routeId === (routeId ?? null)),
    evalRuns: evalRuns.map(toEvalRun).filter((run) => !routeId || run.routeId === routeId),
    route: route ? toModelRoute(route) : null,
  };
}

export async function exportBom(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  format: BomFormat,
  routeId?: string,
) {
  const { userId } = await requireModelAction(context, workspaceId, "view");
  const input = await bomInput(context.repositories, workspaceId, versionId, routeId);

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_version.bom_exported",
    targetType: "model_version",
    targetId: versionId,
    metadata: { routeId: routeId ?? null, format },
  });

  return format === "spdx" ? buildSpdxAiBom(input) : buildMlBom(input);
}

async function trainingDatasets(
  repositories: RepositoryManager,
  workspaceId: string,
  versionId: string,
) {
  const edges = await repositories.modelAssets.listLineage(workspaceId);
  const datasetIds = edges
    .filter((edge) => edge.toVersionId === versionId && edge.relation === "trained_on")
    .map((edge) => edge.fromVersionId);
  const profiles = await repositories.modelDatasets.list(workspaceId, datasetIds);
  const versions = await repositories.modelAssets.listVersions(workspaceId, datasetIds);
  const assets = new Map(
    (await repositories.modelAssets.listAssets(workspaceId, "dataset")).map((asset) => [
      asset.id,
      asset,
    ]),
  );

  return datasetIds.map((id) => {
    const version = versions.find((item) => item.id === id);
    const profile = profiles.find((item) => item.version_id === id);

    return {
      id,
      name: (version && assets.get(version.asset_id)?.display_name) ?? id,
      profile: profile ? toDatasetProfile(profile) : null,
      request: profile?.request ?? {},
    };
  });
}

function baseEdge(edges: readonly LineageEdge[], versionId: string) {
  return edges.find(
    (edge) =>
      edge.toVersionId === versionId &&
      edge.relation !== "trained_on" &&
      edge.relation !== "evaluated_on",
  );
}

export async function exportModelCard(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
) {
  await requireModelAction(context, workspaceId, "view");

  const repositories = context.repositories;
  const { version, asset } = await requireVersion(repositories, workspaceId, versionId);
  const edges = await repositories.modelAssets.listLineage(workspaceId);
  const base = baseEdge(edges, versionId);
  const baseVersion = base
    ? await repositories.modelAssets.getVersion(workspaceId, base.fromVersionId)
    : null;
  const baseAsset = baseVersion
    ? await repositories.modelAssets.getAsset(workspaceId, baseVersion.asset_id)
    : null;
  const [evidence, evalRuns, datasets] = await Promise.all([
    repositories.modelGovernance.listEvidence([versionId]),
    repositories.modelEvals.listRuns({ versionIds: [versionId], limit: 20 }),
    trainingDatasets(repositories, workspaceId, versionId),
  ]);
  const provenance = evidence.find((item) => item.kind === "provenance");
  const flops = version.attributes.trainingComputeFlops;

  return {
    markdown: renderModelCard({
      asset: toModelAsset(asset),
      version: toModelVersion(version),
      base:
        baseAsset && baseVersion
          ? { name: baseAsset.display_name, revision: baseVersion.revision }
          : null,
      datasets: datasets.map((dataset) => ({ name: dataset.name, profile: dataset.profile })),
      evidence: evidence.map(toModelEvidence).filter((item) => item.routeId === null),
      evalRuns: evalRuns.map(toEvalRun),
      compute:
        flops === null
          ? null
          : assessModificationCompute({
              modificationFlops: flops,
              baseTrainingFlops: baseVersion?.attributes.trainingComputeFlops ?? null,
            }),
      intendedUse:
        typeof provenance?.details.intendedUse === "string" ? provenance.details.intendedUse : null,
    }),
  };
}

export async function exportTrainingContentSummary(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
): Promise<TrainingContentSummary> {
  await requireModelAction(context, workspaceId, "view");

  const repositories = context.repositories;
  const { version } = await requireVersion(repositories, workspaceId, versionId);
  const workspace = await repositories.workspaces.getWorkspace(workspaceId);
  const edges = await repositories.modelAssets.listLineage(workspaceId);
  const base = baseEdge(edges, versionId);
  const baseVersion = base
    ? await repositories.modelAssets.getVersion(workspaceId, base.fromVersionId)
    : null;
  const baseAsset = baseVersion
    ? await repositories.modelAssets.getAsset(workspaceId, baseVersion.asset_id)
    : null;
  const flops = version.attributes.trainingComputeFlops;
  const compute =
    flops === null
      ? null
      : assessModificationCompute({
          modificationFlops: flops,
          baseTrainingFlops: baseVersion?.attributes.trainingComputeFlops ?? null,
        });
  const datasets = await trainingDatasets(repositories, workspaceId, versionId);

  return {
    versionId,
    generatedAt: new Date().toISOString(),
    modifier: { workspace: workspace?.name ?? workspaceId },
    baseModel:
      baseAsset && baseVersion
        ? { name: baseAsset.source_ref, revision: baseVersion.revision }
        : null,
    compute,
    providerObligationsLikely: compute?.exceedsThreshold ?? false,
    datasets: datasets.map((dataset) => ({
      name: dataset.name,
      collectionMethod: dataset.profile?.collectionMethod ?? "upload",
      licence: dataset.profile?.governance.licence ?? "unknown",
      lawfulBasis: dataset.profile?.governance.lawfulBasis ?? "unknown",
      personalDataCategories: dataset.profile?.governance.personalDataCategories ?? [],
      rows: dataset.profile?.rows ?? 0,
      tokens: dataset.profile?.tokens ?? 0,
      piiRedacted:
        typeof dataset.request.processing === "object" &&
        dataset.request.processing !== null &&
        "redactPii" in dataset.request.processing
          ? dataset.request.processing.redactPii === true
          : false,
      teacher: dataset.profile?.collectionMethod === "synthetic" ? dataset.profile.sourceRef : null,
    })),
  };
}

export async function exportInventory(
  context: ServiceContext,
  workspaceId: string,
): Promise<{ generatedAt: string; items: ModelInventoryItem[] }> {
  const { userId } = await requireModelAction(context, workspaceId, "view");
  const repositories = context.repositories;
  const scope = await loadRegistryScope(repositories, workspaceId, null);
  const [deployments, aliases] = await Promise.all([
    repositories.modelDeployments.list(workspaceId),
    repositories.modelAliases.list(workspaceId),
  ]);

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_inventory.exported",
    targetType: "model_inventory",
    targetId: workspaceId,
  });

  return {
    generatedAt: new Date().toISOString(),
    items: scope.versions.flatMap((version) => {
      const asset = scope.assets.get(version.asset_id);

      if (!asset) {
        return [];
      }

      const routes = scope.routes.filter(
        (route) => route.version_id === version.id && route.status === "active",
      );
      const standing = versionStanding(scope, version);
      const flops = version.attributes.trainingComputeFlops;

      return [
        {
          versionId: version.id,
          name: asset.display_name,
          kind: asset.kind,
          source: `${asset.source}:${asset.source_ref}`,
          revision: version.revision,
          licence: version.attributes.licence,
          standing: standing?.usable ? "approved" : (standing?.verdict.effect ?? "unknown"),
          owner: version.created_by,
          deployments: deployments.filter((deployment) => deployment.version_id === version.id)
            .length,
          aliases: aliases
            .filter((alias) => routes.some((route) => route.id === alias.route_id))
            .map((alias) => alias.name),
          jurisdictions: [...new Set(routes.map((route) => route.jurisdiction ?? route.region))],
          exceedsModificationThreshold:
            flops !== null &&
            assessModificationCompute({ modificationFlops: flops, baseTrainingFlops: null })
              .exceedsThreshold,
        },
      ];
    }),
  };
}
