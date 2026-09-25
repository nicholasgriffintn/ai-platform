import { buildMlBom, collectAncestry } from "@ngriffin_uk/polychat-library-model-registry";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { notFound, requireRegistryMember } from "./access";
import {
  toEvalRun,
  toModelAsset,
  toModelDecision,
  toModelEvidence,
  toModelFile,
  toModelRoute,
  toModelVersion,
} from "./mappers";

export async function exportMlBom(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  routeId?: string,
) {
  const { userId } = await requireRegistryMember(context, workspaceId);
  const repositories = context.repositories;
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);
  const asset = version
    ? await repositories.modelAssets.getAsset(workspaceId, version.asset_id)
    : null;

  if (!version || !asset) {
    throw notFound("Model version");
  }

  const route = routeId ? await repositories.modelRoutes.getRoute(workspaceId, routeId) : null;

  if (routeId && (!route || route.version_id !== versionId)) {
    throw notFound("Route");
  }

  const lineage = collectAncestry(
    await repositories.modelAssets.listLineage(workspaceId),
    versionId,
  );
  const ancestorIds = [...new Set(lineage.map((edge) => edge.fromVersionId))];
  const ancestorVersions = await repositories.modelAssets.listVersions(workspaceId, ancestorIds);
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

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_version.bom_exported",
    targetType: "model_version",
    targetId: versionId,
    metadata: { routeId: routeId ?? null },
  });

  return buildMlBom({
    serialNumber: crypto.randomUUID(),
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
  });
}
