import {
  assertHubRepo,
  AwsRequester,
  parseS3Uri,
  readAwsSettings,
} from "@ngriffin_uk/polychat-ai-model-providers";
import {
  architectureFromConfig,
  assessRemoteCode,
  collectWeightFormats,
  detectWeightFormat,
  normaliseLicence,
} from "@ngriffin_uk/polychat-library-model-registry";
import {
  type ImportAssetRequest,
  type ImportBucketModelRequest,
  importBucketModelRequestSchema,
  MODEL_REGISTRY_INSPECT_TASK_TYPE,
  type ModelAssetKind,
  type VersionDetail,
} from "@ngriffin_uk/polychat-schemas";
import {
  parseRecordValue,
  readNonEmptyString,
  sha256Hex,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  resolveProviderContext,
  workspaceHubClient,
} from "~/modules/model-governance/application/connections";
import { withProviderErrors } from "~/modules/model-governance/application/provider-errors";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import { badRequest, notFound, requireModelAction } from "./access";
import { syncVersionReviews } from "./decisions";
import { getVersionDetail } from "./library";

const MAX_RECORDED_TAGS = 40;
const REFUSED_EXTENSIONS = [".bin", ".pt", ".pth", ".pkl", ".pickle", ".ckpt"];

export async function enqueueInspection(
  env: IEnv,
  repositories: RepositoryManager,
  versionId: string,
): Promise<void> {
  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${MODEL_REGISTRY_INSPECT_TASK_TYPE}:${versionId}:${Date.now()}`,
    task_type: MODEL_REGISTRY_INSPECT_TASK_TYPE,
    task_data: { versionId },
    priority: 4,
  });
}

async function findWorkspaceVersion(
  repositories: RepositoryManager,
  workspaceId: string,
  sourceRef: string,
): Promise<string | null> {
  for (const kind of ["model", "adapter"] as const) {
    const asset = await repositories.modelAssets.findAssetBySource({
      workspaceId,
      kind,
      source: "huggingface",
      sourceRef,
    });
    const [version] = asset ? await repositories.modelAssets.listAssetVersions(asset.id) : [];

    if (version) {
      return version.id;
    }
  }

  return null;
}

export async function importAsset(
  context: ServiceContext,
  workspaceId: string,
  request: ImportAssetRequest,
): Promise<VersionDetail> {
  const { userId } = await requireModelAction(context, workspaceId, "import");
  const repositories = context.repositories;
  const hub = await workspaceHubClient(repositories, workspaceId);
  const repo = assertHubRepo(request.sourceRef);
  const hubKind = request.kind === "dataset" ? "dataset" : "model";
  const info = await withProviderErrors(() =>
    hub.getRepoInfo({ kind: hubKind, repo, revision: request.revision ?? "main" }),
  );
  const files = await withProviderErrors(() =>
    hub.listFiles({ kind: hubKind, repo: info.id, revision: info.sha }),
  );
  const paths = files.map((file) => file.path);
  const isAdapter = hubKind === "model" && paths.includes("adapter_config.json");
  const kind: ModelAssetKind = hubKind === "dataset" ? "dataset" : isAdapter ? "adapter" : "model";
  const asset = await repositories.modelAssets.createAsset({
    workspaceId,
    kind,
    source: "huggingface",
    sourceRef: info.id,
    displayName: info.id.split("/").pop() ?? info.id,
    createdBy: userId,
  });
  const existing = await repositories.modelAssets.findVersion(asset.id, info.sha);

  if (existing) {
    return getVersionDetail(context, workspaceId, existing.id);
  }

  const reference = { kind: hubKind, repo: info.id, revision: info.sha } as const;
  const adapterManifest = isAdapter
    ? parseRecordValue(await hub.fetchText({ ...reference, path: "adapter_config.json" }))
    : {};
  const adapterBase = readNonEmptyString(adapterManifest.base_model_name_or_path);
  const config = hubKind === "model" && !isAdapter ? await hub.readConfig(reference) : null;
  const baseModels = [...new Set([...info.baseModels, ...(adapterBase ? [adapterBase] : [])])];
  const version = await repositories.modelAssets.createVersion({
    assetId: asset.id,
    workspaceId,
    revision: info.sha,
    status: "inspecting",
    createdBy: userId,
    attributes: {
      licence: normaliseLicence(info.licence),
      formats: hubKind === "model" ? collectWeightFormats(paths) : [],
      parameterCount: info.parameterCount,
      gated: info.gated,
      remoteCode: hubKind === "model" && assessRemoteCode(info.config, paths).remoteCode,
      pipelineTag: info.pipelineTag,
      libraryName: info.libraryName,
      tags: info.tags.slice(0, MAX_RECORDED_TAGS),
      baseModels,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      trainingComputeFlops: null,
      architecture: architectureFromConfig(config),
      location: null,
    },
    files: files.map((file) => ({
      path: file.path,
      size: file.size,
      sha256: file.sha256,
      format: hubKind === "model" ? detectWeightFormat(file.path) : null,
    })),
  });

  for (const baseRef of baseModels) {
    const baseVersionId = await findWorkspaceVersion(repositories, workspaceId, baseRef);

    if (baseVersionId) {
      await repositories.modelAssets.addLineageEdge({
        fromVersionId: baseVersionId,
        toVersionId: version.id,
        relation: isAdapter && baseRef === adapterBase ? "adapter_of" : "fine_tuned_from",
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
      kind,
      requestedRevision: request.revision ?? "main",
      fileCount: files.length,
    },
  });

  await enqueueInspection(context.env, repositories, version.id);

  return getVersionDetail(context, workspaceId, version.id);
}

export async function importBucketModel(
  context: ServiceContext,
  workspaceId: string,
  input: ImportBucketModelRequest,
): Promise<VersionDetail> {
  const { userId } = await requireModelAction(context, workspaceId, "import");
  const request = importBucketModelRequestSchema.parse(input);
  const repositories = context.repositories;
  const providerContext = await resolveProviderContext(repositories, workspaceId, "aws");
  const aws = new AwsRequester(
    readAwsSettings(providerContext.credentials),
    providerContext.fetcher,
  );
  const { bucket, key: prefix } = parseS3Uri(request.uri);
  const objects = await withProviderErrors(() => aws.listS3Prefix(bucket, prefix));
  const files = objects.map((object) => ({ ...object, path: object.key.slice(prefix.length) }));
  const refused = files.filter((file) =>
    REFUSED_EXTENSIONS.some((extension) => file.path.toLowerCase().endsWith(extension)),
  );

  if (files.length === 0) {
    throw notFound(`Files under ${request.uri}`);
  }

  if (refused.length > 0) {
    throw badRequest(`Pickled weights are refused: ${refused.map((file) => file.path).join(", ")}`);
  }

  if (request.kind === "adapter" && !request.baseVersionId) {
    throw badRequest("Choose the base model this adapter was trained on");
  }

  const revision = await sha256Hex(
    files
      .map((file) => `${file.path}:${file.etag ?? ""}:${file.size}`)
      .sort()
      .join("\n"),
  );
  const asset = await repositories.modelAssets.createAsset({
    workspaceId,
    kind: request.kind,
    source: "bucket",
    sourceRef: request.uri,
    displayName: request.name,
    createdBy: userId,
  });
  const existing = await repositories.modelAssets.findVersion(asset.id, revision);

  if (existing) {
    return getVersionDetail(context, workspaceId, existing.id);
  }

  const version = await repositories.modelAssets.createVersion({
    assetId: asset.id,
    workspaceId,
    revision,
    status: "ready",
    createdBy: userId,
    attributes: {
      licence: normaliseLicence(request.licence),
      formats: collectWeightFormats(files.map((file) => file.path)),
      parameterCount: null,
      gated: false,
      remoteCode: false,
      pipelineTag: "text-generation",
      libraryName: request.kind === "adapter" ? "peft" : "transformers",
      tags: ["bucket"],
      baseModels: [],
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      trainingComputeFlops: null,
      architecture: null,
      location: request.uri,
    },
    files: files.map((file) => ({
      path: file.path,
      size: file.size,
      sha256: null,
      format: detectWeightFormat(file.path),
    })),
  });

  if (request.kind === "adapter" && request.baseVersionId) {
    await repositories.modelAssets.addLineageEdge({
      fromVersionId: request.baseVersionId,
      toVersionId: version.id,
      relation: "adapter_of",
    });
  }

  await repositories.modelGovernance.addEvidence([
    {
      versionId: version.id,
      kind: "provenance",
      source: "upload",
      status: "warn",
      summary: `Imported from ${request.uri}: ${request.provenance.slice(0, 200)}`,
      details: { uri: request.uri, provenance: request.provenance },
    },
    {
      versionId: version.id,
      kind: "format",
      source: "static_inspection",
      status: files.some((file) => file.path.endsWith(".safetensors")) ? "pass" : "warn",
      summary: `${files.length} files; formats ${collectWeightFormats(files.map((file) => file.path)).join(", ") || "unknown"}`,
      details: { files: files.map((file) => file.path) },
    },
  ]);
  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_version.imported",
    targetType: "model_version",
    targetId: version.id,
    metadata: { source: "bucket", uri: request.uri, revision, kind: request.kind },
  });
  await syncVersionReviews(repositories, workspaceId, version.id);

  return getVersionDetail(context, workspaceId, version.id);
}

export async function reinspectVersion(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
): Promise<VersionDetail> {
  const { userId } = await requireModelAction(context, workspaceId, "approve");
  const repositories = context.repositories;
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);

  if (!version) {
    throw notFound("Model version");
  }

  await repositories.modelAssets.updateVersion(versionId, { status: "inspecting" });
  await enqueueInspection(context.env, repositories, versionId);
  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_version.reinspected",
    targetType: "model_version",
    targetId: versionId,
  });

  return getVersionDetail(context, workspaceId, versionId);
}
