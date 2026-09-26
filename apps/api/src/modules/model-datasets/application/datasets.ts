import { collectDescendants, suggestMapping } from "@ngriffin_uk/polychat-library-model-registry";
import {
  type CreateDatasetRequest,
  DATASET_SPLITS,
  createDatasetRequestSchema,
  type DatasetDetail,
  type DatasetMapping,
  type DatasetProfile,
  type DatasetRow,
  type DatasetRowsQuery,
  type DatasetRowsResponse,
  type DatasetStats,
  type DatasetSummary,
  type ErasureRequest,
  type ErasureResult,
  type ExcludeDatasetRowsRequest,
  MODEL_DATASET_PROCESS_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord, readTextLines } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { workspaceHubClient } from "~/modules/model-governance/application/connections";
import { withProviderErrors } from "~/modules/model-governance/application/provider-errors";
import {
  badRequest,
  conflict,
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "~/modules/model-registry/application/access";
import { syncVersionReviews } from "~/modules/model-registry/application/decisions";
import {
  loadRegistryScope,
  requireUsableVersion,
  versionStanding,
} from "~/modules/model-registry/application/scope";
import { ArtefactStore, artefactKeys } from "~/modules/model-registry/infrastructure/ArtefactStore";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import type { ModelDatasetProfileRecord } from "../infrastructure/ModelDatasetRepository";
import { formatFromPath, parquetRows, r2AsyncBuffer, streamRows } from "./sources";

const PREVIEW_ROWS = 25;

const SOURCE_BY_COLLECTION = {
  upload: "upload",
  hub: "huggingface",
  bucket: "bucket",
  conversations: "derived",
  synthetic: "derived",
} as const;

export async function enqueueDatasetProcessing(
  env: IEnv,
  repositories: RepositoryManager,
  versionId: string,
) {
  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${MODEL_DATASET_PROCESS_TASK_TYPE}:${versionId}:${Date.now()}`,
    task_type: MODEL_DATASET_PROCESS_TASK_TYPE,
    task_data: { versionId },
    priority: 5,
  });
}

export function toDatasetProfile(record: ModelDatasetProfileRecord): DatasetProfile {
  const stats: DatasetStats = record.stats;

  return {
    versionId: record.version_id,
    status: record.status,
    shape: record.shape,
    mapping: record.mapping,
    governance: record.governance,
    collectionMethod: record.collection_method,
    rows: stats.rows ?? 0,
    tokens: stats.tokens ?? 0,
    meanTokens: stats.meanTokens ?? 0,
    p95Tokens: stats.p95Tokens ?? 0,
    maxTokens: stats.maxTokens ?? 0,
    duplicatesRemoved: stats.duplicatesRemoved ?? 0,
    invalidRows: stats.invalidRows ?? 0,
    flaggedRows: stats.flaggedRows ?? 0,
    decontaminatedRows: stats.decontaminatedRows ?? 0,
    languages: stats.languages ?? {},
    piiBefore: stats.piiBefore ?? {},
    piiAfter: stats.piiAfter ?? {},
    lengthHistogram: stats.lengthHistogram ?? [],
    splits: stats.splits ?? [],
    sourceRef: record.source_ref,
    failureReason: record.failure_reason,
    processedAt: record.processed_at,
  };
}

async function sourceIdentity(
  context: ServiceContext,
  workspaceId: string,
  request: ReturnType<typeof createDatasetRequestSchema.parse>,
  userId: number,
): Promise<{ sourceRef: string; sourceRevision: string | null }> {
  switch (request.source) {
    case "upload": {
      const upload = await context.repositories.modelUploads.get(workspaceId, request.uploadId);

      if (!upload || upload.status !== "ready" || upload.purpose !== "dataset") {
        throw badRequest("Upload a dataset file and wait for it to finish first");
      }

      return { sourceRef: `upload/${upload.id}/${upload.name}`, sourceRevision: null };
    }

    case "hub": {
      const hub = await workspaceHubClient(context.repositories, workspaceId);
      const info = await withProviderErrors(() =>
        hub.getRepoInfo({
          kind: "dataset",
          repo: request.repo,
          revision: request.revision ?? "main",
        }),
      );

      return { sourceRef: info.id, sourceRevision: info.sha };
    }

    case "bucket":
      formatFromPath(request.uri);

      return { sourceRef: request.uri, sourceRevision: null };
    case "conversations":
      return {
        sourceRef: `polychat/conversations/${request.projectId ?? workspaceId}`,
        sourceRevision: null,
      };
    default: {
      const route = await context.repositories.modelRoutes.getRoute(
        workspaceId,
        request.teacher.routeId,
      );

      if (!route || route.status !== "active") {
        throw notFound("Teacher route");
      }

      await requireUsableVersion(
        context.repositories,
        workspaceId,
        request.projectId,
        route.version_id,
        "Teacher model",
      );

      return {
        sourceRef: `polychat/synthetic/${route.provider}/${route.provider_model_id}/${userId}`,
        sourceRevision: null,
      };
    }
  }
}

export async function createDataset(
  context: ServiceContext,
  workspaceId: string,
  input: CreateDatasetRequest,
): Promise<DatasetSummary> {
  const { userId } = await requireModelAction(context, workspaceId, "build_datasets");
  const request = createDatasetRequestSchema.parse(input);
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);

  if (request.source === "bucket") {
    const connection = await context.repositories.modelConnections.getConnection(
      workspaceId,
      "aws",
    );

    if (!connection?.capabilities.read) {
      throw conflict("Connect AWS with read access to the bucket first");
    }
  }

  const { sourceRef, sourceRevision } = await sourceIdentity(context, workspaceId, request, userId);
  const repositories = context.repositories;
  const asset = await repositories.modelAssets.createAsset({
    workspaceId,
    kind: "dataset",
    source: SOURCE_BY_COLLECTION[request.source],
    sourceRef: `${sourceRef}#${request.name}`,
    displayName: request.name,
    createdBy: userId,
  });
  const version = await repositories.modelAssets.createVersion({
    assetId: asset.id,
    workspaceId,
    revision: `pending:${crypto.randomUUID()}`,
    status: "inspecting",
    createdBy: userId,
    attributes: {
      licence: request.governance.licence,
      formats: [],
      parameterCount: null,
      gated: false,
      remoteCode: false,
      pipelineTag: null,
      libraryName: null,
      tags: [request.source, request.mapping.shape],
      baseModels: [],
      totalBytes: 0,
      trainingComputeFlops: null,
      architecture: null,
      location: null,
    },
    files: [],
  });
  const profile = await repositories.modelDatasets.create({
    versionId: version.id,
    workspaceId,
    shape: request.mapping.shape,
    mapping: request.mapping,
    governance: request.governance,
    collectionMethod: request.source,
    sourceRef,
    request: { ...request, projectId },
  });

  if (sourceRevision) {
    await repositories.modelDatasets.update(version.id, { stats: { sourceRevision } });
  }

  if (request.source === "upload") {
    await repositories.modelUploads.update(request.uploadId, { consumed_by: version.id });
  }

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_dataset.created",
    targetType: "model_version",
    targetId: version.id,
    metadata: {
      source: request.source,
      sourceRef,
      governance: request.governance,
      mapping: request.mapping,
    },
  });
  await enqueueDatasetProcessing(context.env, repositories, version.id);

  return summarise(context, workspaceId, version.id, profile);
}

async function summarise(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  profile: ModelDatasetProfileRecord | null,
): Promise<DatasetSummary> {
  const repositories = context.repositories;
  const scope = await loadRegistryScope(repositories, workspaceId, null, {
    versionIds: [versionId],
  });
  const version = scope.versions[0];
  const asset = version ? scope.assets.get(version.asset_id) : undefined;

  if (!version || !asset) {
    throw notFound("Dataset");
  }

  const standing = versionStanding(scope, version);
  const edges = await repositories.modelAssets.listLineage(workspaceId);

  return {
    assetId: asset.id,
    versionId: version.id,
    name: asset.display_name,
    revision: version.revision,
    profile: profile ? toDatasetProfile(profile) : null,
    verdict: standing?.verdict ?? { effect: "allow", matches: [], policyHashes: [] },
    usable: standing?.usable ?? false,
    createdAt: version.created_at,
    usedBy: edges.filter(
      (edge) => edge.fromVersionId === version.id && edge.relation === "trained_on",
    ).length,
  };
}

export async function listDatasets(
  context: ServiceContext,
  workspaceId: string,
  projectIdInput?: string,
): Promise<{ datasets: DatasetSummary[] }> {
  await requireModelAction(context, workspaceId, "view");

  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);
  const repositories = context.repositories;
  const profiles = await repositories.modelDatasets.list(workspaceId);
  const scope = await loadRegistryScope(repositories, workspaceId, projectId, {
    versionIds: profiles.map((profile) => profile.version_id),
  });
  const edges = await repositories.modelAssets.listLineage(workspaceId);

  return {
    datasets: scope.versions.flatMap((version) => {
      const asset = scope.assets.get(version.asset_id);
      const profile = profiles.find((item) => item.version_id === version.id);

      if (!asset || !profile) {
        return [];
      }

      const standing = versionStanding(scope, version);

      return [
        {
          assetId: asset.id,
          versionId: version.id,
          name: asset.display_name,
          revision: version.revision,
          profile: toDatasetProfile(profile),
          verdict: standing?.verdict ?? { effect: "allow", matches: [], policyHashes: [] },
          usable: standing?.usable ?? false,
          createdAt: version.created_at,
          usedBy: edges.filter(
            (edge) => edge.fromVersionId === version.id && edge.relation === "trained_on",
          ).length,
        },
      ];
    }),
  };
}

export async function getDatasetDetail(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
): Promise<DatasetDetail> {
  await requireModelAction(context, workspaceId, "view");

  const repositories = context.repositories;
  const profile = await repositories.modelDatasets.get(versionId);

  if (!profile || profile.workspace_id !== workspaceId) {
    throw notFound("Dataset");
  }

  const summary = await summarise(context, workspaceId, versionId, profile);
  const [versions, edges] = await Promise.all([
    repositories.modelAssets.listAssetVersions(summary.assetId),
    repositories.modelAssets.listLineage(workspaceId),
  ]);

  return {
    ...summary,
    versions: versions.map((version) => ({
      id: version.id,
      revision: version.revision,
      createdAt: version.created_at,
    })),
    derivedFrom: edges
      .filter((edge) => edge.toVersionId === versionId && edge.relation === "derived_from")
      .map((edge) => edge.fromVersionId),
    usedByVersionIds: edges
      .filter((edge) => edge.fromVersionId === versionId && edge.relation === "trained_on")
      .map((edge) => edge.toVersionId),
  };
}

export async function readDatasetRows(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  input: DatasetRowsQuery,
): Promise<DatasetRowsResponse> {
  await requireModelAction(context, workspaceId, "view");

  const query = input;
  const profile = await context.repositories.modelDatasets.get(versionId);

  if (!profile || profile.workspace_id !== workspaceId || profile.status !== "ready") {
    throw notFound("Processed dataset");
  }

  const stats: DatasetStats = profile.stats;
  const flagged = new Set(stats.flaggedIndexes?.[query.split] ?? []);
  const total = stats.splits?.find((split) => split.name === query.split)?.rows ?? 0;
  const object = await new ArtefactStore(context.env).get(
    artefactKeys.datasetSplit(workspaceId, versionId, query.split),
  );

  if (!object) {
    return { rows: [], total: 0 };
  }

  const rows: DatasetRow[] = [];
  let index = 0;

  for await (const line of readTextLines(object.body)) {
    if (!line.trim()) {
      continue;
    }

    const include = query.flaggedOnly ? flagged.has(index) : index >= query.offset;

    if (include) {
      const parsed: unknown = JSON.parse(line);

      rows.push({
        index,
        split: query.split,
        flags: flagged.has(index) ? ["flagged"] : [],
        record: isRecord(parsed) ? parsed : { value: parsed },
      });
    }

    index += 1;

    if (rows.length >= query.limit) {
      break;
    }
  }

  return { rows, total: query.flaggedOnly ? flagged.size : total };
}

async function copyWithout(
  context: ServiceContext,
  workspaceId: string,
  source: ModelDatasetProfileRecord,
  targetVersionId: string,
  split: (typeof DATASET_SPLITS)[number],
  excluded: ReadonlySet<number>,
) {
  const store = new ArtefactStore(context.env);
  const object = await store.get(artefactKeys.datasetSplit(workspaceId, source.version_id, split));
  const writer = store.writer(artefactKeys.datasetSplit(workspaceId, targetVersionId, split));
  let index = 0;
  let kept = 0;

  if (object) {
    for await (const line of readTextLines(object.body)) {
      if (!line.trim()) {
        continue;
      }

      if (!excluded.has(index)) {
        await writer.writeLine(JSON.parse(line));
        kept += 1;
      }

      index += 1;
    }
  }

  return { bytes: await writer.close(), kept };
}

async function deriveWithout(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  request: { split: (typeof DATASET_SPLITS)[number]; indexes: number[]; reason: string },
  userId: number,
): Promise<string> {
  const repositories = context.repositories;
  const source = await repositories.modelDatasets.get(versionId);
  const sourceVersion = await repositories.modelAssets.getVersion(workspaceId, versionId);

  if (!source || !sourceVersion || source.status !== "ready") {
    throw notFound("Processed dataset");
  }

  const version = await repositories.modelAssets.createVersion({
    assetId: sourceVersion.asset_id,
    workspaceId,
    revision: `pending:${crypto.randomUUID()}`,
    status: "inspecting",
    createdBy: userId,
    attributes: sourceVersion.attributes,
    files: [],
  });
  const stats: DatasetStats = source.stats;
  const files = [];
  const splits = [];

  for (const split of DATASET_SPLITS) {
    const excluded = split === request.split ? new Set(request.indexes) : new Set<number>();
    const copied = await copyWithout(context, workspaceId, source, version.id, split, excluded);
    const before = stats.splits?.find((item) => item.name === split);

    if (copied.kept > 0) {
      files.push({ path: `${split}.jsonl`, size: copied.bytes, sha256: null, format: null });
    }

    splits.push({
      name: split,
      rows: copied.kept,
      tokens:
        before && before.rows > 0 ? Math.round((before.tokens * copied.kept) / before.rows) : 0,
    });
  }

  const profile = await repositories.modelDatasets.create({
    versionId: version.id,
    workspaceId,
    shape: source.shape,
    mapping: source.mapping,
    governance: source.governance,
    collectionMethod: source.collection_method,
    sourceRef: source.source_ref,
    request: source.request,
  });
  const rows = splits.reduce((sum, split) => sum + split.rows, 0);

  await repositories.modelDatasets.update(profile.version_id, {
    status: "ready",
    processed_at: new Date().toISOString(),
    stats: {
      ...stats,
      rows,
      tokens: splits.reduce((sum, split) => sum + split.tokens, 0),
      splits,
      flaggedIndexes: { train: [], validation: [], test: [] },
      flaggedRows: 0,
    },
  });
  await repositories.modelAssets.finaliseRevision(version.id, {
    revision: `${sourceVersion.revision.slice(0, 40)}-minus-${request.indexes.length}-${Date.now().toString(36)}`,
    attributes: {
      ...sourceVersion.attributes,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    },
    files,
  });
  await repositories.modelAssets.updateVersion(version.id, { status: "ready" });
  await repositories.modelAssets.addLineageEdge({
    fromVersionId: versionId,
    toVersionId: version.id,
    relation: "derived_from",
  });
  await repositories.modelGovernance.addEvidence(
    (await repositories.modelGovernance.listEvidence([versionId]))
      .filter((item) => item.route_id === null)
      .map((item) => ({
        versionId: version.id,
        kind: item.kind,
        source: item.source,
        status: item.status,
        summary: item.summary,
        details: { ...item.details, inheritedFrom: versionId },
      })),
  );
  await repositories.modelGovernance.addEvidence([
    {
      versionId: version.id,
      kind: "dataset_stats",
      source: "dataset_pipeline",
      status: "pass",
      summary: `${request.indexes.length} ${request.split} rows removed: ${request.reason}`,
      details: {
        removed: request.indexes.length,
        split: request.split,
        reason: request.reason,
        rows,
      },
    },
  ]);
  await syncVersionReviews(repositories, workspaceId, version.id);

  return version.id;
}

export async function excludeDatasetRows(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  request: ExcludeDatasetRowsRequest,
): Promise<DatasetSummary> {
  const { userId } = await requireModelAction(context, workspaceId, "build_datasets");
  const derivedId = await deriveWithout(context, workspaceId, versionId, request, userId);

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_dataset.rows_excluded",
    targetType: "model_version",
    targetId: derivedId,
    metadata: {
      from: versionId,
      split: request.split,
      count: request.indexes.length,
      reason: request.reason,
    },
  });

  return summarise(
    context,
    workspaceId,
    derivedId,
    await context.repositories.modelDatasets.get(derivedId),
  );
}

export async function requestErasure(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  request: ErasureRequest,
): Promise<ErasureResult> {
  const { userId } = await requireModelAction(context, workspaceId, "approve");
  const repositories = context.repositories;
  const cleanId = await deriveWithout(context, workspaceId, versionId, request, userId);
  const edges = await repositories.modelAssets.listLineage(workspaceId);
  const affected = collectDescendants(edges, versionId).filter((id) => id !== cleanId);
  const dueAt = new Date(Date.now() + request.dueInDays * 86_400_000).toISOString();
  const routes = await repositories.modelRoutes.listRoutes(workspaceId, {
    versionIds: affected,
    activeOnly: true,
  });

  await repositories.modelGovernance.addEvidence(
    [versionId, ...affected].map((id) => ({
      versionId: id,
      kind: "erasure" as const,
      source: "erasure_request" as const,
      status: request.action === "withdraw" ? ("fail" as const) : ("warn" as const),
      summary:
        request.action === "withdraw"
          ? `Withdrawn: trained on rows erased from ${versionId}`
          : `Retrain by ${dueAt.slice(0, 10)}: trained on rows erased from ${versionId}`,
      details: {
        datasetVersionId: versionId,
        cleanVersionId: cleanId,
        reason: request.reason,
        dueAt,
      },
    })),
  );

  for (const id of [versionId, ...affected]) {
    await syncVersionReviews(repositories, workspaceId, id);
  }

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_dataset.erasure_requested",
    targetType: "model_version",
    targetId: versionId,
    metadata: {
      action: request.action,
      split: request.split,
      count: request.indexes.length,
      reason: request.reason,
      affected,
      cleanVersionId: cleanId,
      dueAt,
    },
  });

  return {
    datasetVersionId: cleanId,
    affectedVersionIds: affected,
    affectedRouteIds: routes.map((route) => route.id),
    action: request.action,
    dueAt,
  };
}

export async function previewUploadColumns(
  context: ServiceContext,
  workspaceId: string,
  uploadId: string,
): Promise<{ columns: string[]; mapping: DatasetMapping; sample: Array<Record<string, unknown>> }> {
  await requireModelAction(context, workspaceId, "build_datasets");

  const upload = await context.repositories.modelUploads.get(workspaceId, uploadId);

  if (!upload || upload.status !== "ready") {
    throw notFound("Finished upload");
  }

  const [file] = upload.files;
  const format = formatFromPath(file.path);
  const sample: Array<Record<string, unknown>> = [];
  const store = new ArtefactStore(context.env);
  const rows =
    format === "parquet"
      ? parquetRows(
          r2AsyncBuffer(context.env.PRIVATE_ASSETS_BUCKET, file.key, file.size),
          PREVIEW_ROWS,
        )
      : streamRows(format, (await store.get(file.key))?.body ?? new ReadableStream(), file.size);

  for await (const row of rows) {
    sample.push(row);

    if (sample.length >= PREVIEW_ROWS) {
      break;
    }
  }

  const columns = [...new Set(sample.flatMap((row) => Object.keys(row)))];

  return { columns, mapping: suggestMapping(columns), sample };
}
