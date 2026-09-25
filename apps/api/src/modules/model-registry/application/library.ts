import { collectAncestry } from "@ngriffin_uk/polychat-library-model-registry";
import type { LibraryEntry, LibraryQuery, VersionDetail } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { notFound, requireRegistryMember, requireWorkspaceProject } from "./access";
import {
  toEvalRun,
  toModelAsset,
  toModelDecision,
  toModelFile,
  toModelRoute,
  toModelVersion,
} from "./mappers";
import { loadRegistryScope, versionStanding } from "./scope";

export async function listLibrary(
  context: ServiceContext,
  workspaceId: string,
  query: LibraryQuery,
): Promise<{ entries: LibraryEntry[] }> {
  await requireRegistryMember(context, workspaceId);

  const projectId = await requireWorkspaceProject(context, workspaceId, query.projectId);
  const scope = await loadRegistryScope(context.repositories, workspaceId, projectId);
  const latestByAsset = new Map<string, (typeof scope.versions)[number]>();

  for (const version of scope.versions) {
    if (!latestByAsset.has(version.asset_id)) {
      latestByAsset.set(version.asset_id, version);
    }
  }

  const entries: LibraryEntry[] = [];

  for (const [assetId, version] of latestByAsset) {
    const asset = scope.assets.get(assetId);
    const standing = versionStanding(scope, version);

    if (!asset || !standing || (query.kind && asset.kind !== query.kind)) {
      continue;
    }

    if (query.approvedOnly && !standing.usable) {
      continue;
    }

    entries.push({
      asset: toModelAsset(asset),
      version: toModelVersion(version),
      verdict: standing.verdict,
      usable: standing.usable,
      decision: standing.decision ? toModelDecision(standing.decision) : null,
      routeCount: scope.routes.filter(
        (route) => route.version_id === version.id && route.status === "active",
      ).length,
    });
  }

  return { entries };
}

export async function getVersionDetail(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  projectIdInput?: string,
): Promise<VersionDetail> {
  await requireRegistryMember(context, workspaceId);

  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);
  const repositories = context.repositories;
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);

  if (!version) {
    throw notFound("Model version");
  }

  const [asset, files, siblings, lineage, evalRuns, allDecisions] = await Promise.all([
    repositories.modelAssets.getAsset(workspaceId, version.asset_id),
    repositories.modelAssets.listFiles(versionId),
    repositories.modelAssets.listAssetVersions(version.asset_id),
    repositories.modelAssets.listLineage(workspaceId),
    repositories.modelEvals.listRuns({ versionIds: [versionId], limit: 50 }),
    repositories.modelGovernance.listDecisions(workspaceId, { versionIds: [versionId] }),
  ]);

  if (!asset) {
    throw notFound("Model asset");
  }

  const scope = await loadRegistryScope(repositories, workspaceId, projectId, {
    versionIds: [versionId],
  });
  const standing = versionStanding(scope, version);
  const relatedLineage = [
    ...collectAncestry(lineage, versionId),
    ...lineage.filter((edge) => edge.fromVersionId === versionId),
  ];

  return {
    asset: toModelAsset(asset),
    version: toModelVersion(version),
    files: files.map(toModelFile),
    evidence: scope.evidence,
    decisions: allDecisions.map(toModelDecision),
    routes: scope.routes.map(toModelRoute),
    lineage: relatedLineage,
    evalRuns: evalRuns.map(toEvalRun),
    verdict: standing?.verdict ?? { effect: "review", matches: [], policyHashes: [] },
    versions: siblings.map((sibling) => ({
      id: sibling.id,
      revision: sibling.revision,
      createdAt: sibling.created_at,
    })),
  };
}
