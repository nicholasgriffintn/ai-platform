import { assertHubRepo } from "@ngriffin_uk/polychat-ai-model-sources";
import {
  assessRemoteCode,
  collectWeightFormats,
  detectWeightFormat,
  normaliseLicence,
} from "@ngriffin_uk/polychat-library-model-registry";
import {
  MODEL_REGISTRY_INSPECT_TASK_TYPE,
  type ImportAssetRequest,
  type VersionDetail,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import { notFound, requireRegistryGovernor, requireRegistryMember } from "./access";
import { workspaceHubClient } from "./hub";
import { withHubErrors } from "./hub-errors";
import { getVersionDetail } from "./library";

const MAX_RECORDED_TAGS = 40;

export async function enqueueInspection(
  env: IEnv,
  repositories: RepositoryManager,
  versionId: string,
): Promise<void> {
  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${MODEL_REGISTRY_INSPECT_TASK_TYPE}:${versionId}`,
    task_type: MODEL_REGISTRY_INSPECT_TASK_TYPE,
    task_data: { versionId },
    priority: 4,
  });
}

export async function importAsset(
  context: ServiceContext,
  workspaceId: string,
  request: ImportAssetRequest,
): Promise<VersionDetail> {
  const { userId } = await requireRegistryMember(context, workspaceId);
  const repositories = context.repositories;
  const hub = await workspaceHubClient(context.env, repositories, workspaceId);
  const repo = assertHubRepo(request.sourceRef);
  const info = await withHubErrors(() =>
    hub.getRepoInfo({ kind: request.kind, repo, revision: request.revision ?? "main" }),
  );
  const asset = await repositories.modelAssets.createAsset({
    workspaceId,
    kind: request.kind,
    source: "huggingface",
    sourceRef: info.id,
    displayName: info.id.split("/").pop() ?? info.id,
    createdBy: userId,
  });
  const existing = await repositories.modelAssets.findVersion(asset.id, info.sha);

  if (existing) {
    return getVersionDetail(context, workspaceId, existing.id);
  }

  const files = await withHubErrors(() =>
    hub.listFiles({ kind: request.kind, repo: info.id, revision: info.sha }),
  );
  const paths = files.map((file) => file.path);
  const version = await repositories.modelAssets.createVersion({
    assetId: asset.id,
    workspaceId,
    revision: info.sha,
    status: "inspecting",
    createdBy: userId,
    attributes: {
      licence: normaliseLicence(info.licence),
      formats: request.kind === "model" ? collectWeightFormats(paths) : [],
      parameterCount: info.parameterCount,
      gated: info.gated,
      remoteCode: request.kind === "model" && assessRemoteCode(info.config, paths).remoteCode,
      pipelineTag: info.pipelineTag,
      libraryName: info.libraryName,
      tags: info.tags.slice(0, MAX_RECORDED_TAGS),
      baseModels: info.baseModels,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      trainingComputeFlops: null,
    },
    files: files.map((file) => ({
      path: file.path,
      size: file.size,
      sha256: file.sha256,
      format: request.kind === "model" ? detectWeightFormat(file.path) : null,
    })),
  });

  for (const baseRef of info.baseModels) {
    const base = await repositories.modelAssets.findAssetBySource({
      workspaceId,
      kind: "model",
      source: "huggingface",
      sourceRef: baseRef,
    });
    const [baseVersion] = base ? await repositories.modelAssets.listAssetVersions(base.id) : [];

    if (baseVersion) {
      await repositories.modelAssets.addLineageEdge({
        fromVersionId: baseVersion.id,
        toVersionId: version.id,
        relation: "fine_tuned_from",
      });
    }
  }

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_version.imported",
    targetType: "model_version",
    targetId: version.id,
    metadata: {
      source: "huggingface",
      sourceRef: info.id,
      revision: info.sha,
      requestedRevision: request.revision ?? "main",
      fileCount: files.length,
    },
  });

  await enqueueInspection(context.env, repositories, version.id);

  return getVersionDetail(context, workspaceId, version.id);
}

export async function reinspectVersion(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
): Promise<VersionDetail> {
  const { userId } = await requireRegistryGovernor(context, workspaceId);
  const repositories = context.repositories;
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);

  if (!version) {
    throw notFound("Model version");
  }

  await repositories.modelAssets.updateVersion(versionId, { status: "inspecting" });
  await new TaskService(context.env, repositories.tasks).enqueueTask({
    id: `${MODEL_REGISTRY_INSPECT_TASK_TYPE}:${versionId}:${Date.now()}`,
    task_type: MODEL_REGISTRY_INSPECT_TASK_TYPE,
    task_data: { versionId },
    priority: 4,
  });
  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_version.reinspected",
    targetType: "model_version",
    targetId: versionId,
  });

  return getVersionDetail(context, workspaceId, versionId);
}
