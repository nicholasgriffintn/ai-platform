import { createHash } from "node:crypto";

import {
  HuggingFaceJobsClient,
  startHubPublishJob,
} from "@ngriffin_uk/polychat-ai-model-providers";
import { PENDING, type PollOutcome } from "@ngriffin_uk/polychat-ai-workflows";
import {
  collectWeightFormats,
  detectWeightFormat,
  normaliseLicence,
} from "@ngriffin_uk/polychat-library-model-registry";
import {
  type CreateUploadRequest,
  MAX_DATASET_UPLOAD_BYTES,
  MODEL_UPLOAD_FINALISE_TASK_TYPE,
  type RegisterUploadedModelRequest,
  registerUploadedModelRequestSchema,
  UPLOAD_PART_BYTES,
  type UploadSession,
  type VersionDetail,
} from "@ngriffin_uk/polychat-schemas";
import {
  getErrorMessage,
  readNonEmptyString,
  sha256Hex,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  resolveHubAccess,
  workspaceHubClient,
} from "~/modules/model-governance/application/connections";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import { ArtefactStore, artefactKeys } from "../infrastructure/ArtefactStore";
import type { ModelUploadRecord, StoredUploadFile } from "../infrastructure/ModelUploadRepository";
import {
  badRequest,
  conflict,
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "./access";
import { syncVersionReviews } from "./decisions";
import { hubLocation } from "./handles";
import { enqueueInspection } from "./importing";
import { getVersionDetail } from "./library";

const REFUSED_EXTENSIONS = [".bin", ".pt", ".pth", ".pkl", ".pickle", ".ckpt"];
const WEIGHT_EXTENSIONS = [".safetensors", ".gguf", ".onnx"];
const DATASET_EXTENSIONS = [".jsonl", ".ndjson", ".json", ".csv", ".parquet"];
const PRESIGN_SECONDS = 12 * 60 * 60;

export function toUploadSession(record: ModelUploadRecord): UploadSession {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    purpose: record.purpose,
    name: record.name,
    status: record.status,
    files: record.files.map((file) => ({
      index: file.index,
      path: file.path,
      size: file.size,
      partCount: file.partCount,
      partsUploaded: file.partsUploaded,
      sha256: file.sha256,
    })),
    partBytes: record.part_bytes,
    failureReason: record.failure_reason,
    createdAt: record.created_at,
  };
}

async function enqueueFinalise(
  env: IEnv,
  repositories: RepositoryManager,
  data: { uploadId: string; versionId?: string; publishJobId?: string },
) {
  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${MODEL_UPLOAD_FINALISE_TASK_TYPE}:${data.uploadId}:${Date.now()}`,
    task_type: MODEL_UPLOAD_FINALISE_TASK_TYPE,
    task_data: data,
    priority: 5,
  });
}

function validateFiles(request: CreateUploadRequest) {
  const paths = request.files.map((file) => file.path.toLowerCase());

  if (new Set(paths).size !== paths.length) {
    throw badRequest("Each file path must be unique");
  }

  if (request.purpose === "dataset") {
    if (!paths.every((path) => DATASET_EXTENSIONS.some((extension) => path.endsWith(extension)))) {
      throw badRequest("Datasets must be JSONL, JSON, CSV or Parquet files");
    }

    if (request.files.reduce((sum, file) => sum + file.size, 0) > MAX_DATASET_UPLOAD_BYTES) {
      throw badRequest("Datasets are limited to 512 MB per upload");
    }

    return;
  }

  const refused = paths.filter((path) =>
    REFUSED_EXTENSIONS.some((extension) => path.endsWith(extension)),
  );

  if (refused.length > 0) {
    throw badRequest(
      `Pickled weights are refused: ${refused.join(", ")}. Convert them to safetensors first.`,
    );
  }

  if (!paths.some((path) => WEIGHT_EXTENSIONS.some((extension) => path.endsWith(extension)))) {
    throw badRequest("Include safetensors, GGUF or ONNX weights");
  }

  if (request.purpose === "adapter" && !paths.includes("adapter_config.json")) {
    throw badRequest("An adapter needs adapter_config.json");
  }
}

export async function createUpload(
  context: ServiceContext,
  workspaceId: string,
  request: CreateUploadRequest,
): Promise<UploadSession> {
  const { userId } = await requireModelAction(context, workspaceId, "upload");

  validateFiles(request);

  const store = new ArtefactStore(context.env);
  const uploadKey = crypto.randomUUID();
  const files: StoredUploadFile[] = [];

  for (const [index, file] of request.files.entries()) {
    const key = artefactKeys.uploadFile(workspaceId, uploadKey, file.path);
    const multipart = await store.createMultipartUpload(key, "application/octet-stream");

    files.push({
      index,
      path: file.path,
      size: file.size,
      partCount: Math.max(1, Math.ceil(file.size / UPLOAD_PART_BYTES)),
      partsUploaded: [],
      sha256: null,
      key,
      multipartId: multipart.uploadId,
      etags: {},
    });
  }

  const upload = await context.repositories.modelUploads.create({
    workspaceId,
    purpose: request.purpose,
    name: request.name,
    files,
    partBytes: UPLOAD_PART_BYTES,
    createdBy: userId,
  });

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_upload.started",
    targetType: "model_upload",
    targetId: upload.id,
    metadata: { purpose: request.purpose, name: request.name, files: request.files },
  });

  return toUploadSession(upload);
}

async function requireOpenUpload(context: ServiceContext, workspaceId: string, uploadId: string) {
  const upload = await context.repositories.modelUploads.get(workspaceId, uploadId);

  if (!upload) {
    throw notFound("Upload");
  }

  if (upload.status !== "uploading") {
    throw conflict(`The upload is already ${upload.status}`);
  }

  return upload;
}

export async function uploadPart(
  context: ServiceContext,
  workspaceId: string,
  uploadId: string,
  fileIndex: number,
  partNumber: number,
  body: ReadableStream<Uint8Array> | null,
  contentLength: number,
): Promise<{ partNumber: number; etag: string }> {
  await requireModelAction(context, workspaceId, "upload");

  const upload = await requireOpenUpload(context, workspaceId, uploadId);
  const file = upload.files.find((item) => item.index === fileIndex);

  if (!file || partNumber > file.partCount) {
    throw notFound("Upload part");
  }

  const expected =
    partNumber < file.partCount
      ? upload.part_bytes
      : file.size - upload.part_bytes * (file.partCount - 1);

  if (!body || contentLength !== expected) {
    throw badRequest(`Part ${partNumber} of ${file.path} must be exactly ${expected} bytes`);
  }

  const part = await new ArtefactStore(context.env)
    .resumeMultipartUpload(file.key, file.multipartId)
    .uploadPart(partNumber, body);
  const latest = await context.repositories.modelUploads.get(workspaceId, uploadId);

  if (latest) {
    await context.repositories.modelUploads.update(uploadId, {
      files: latest.files.map((item) =>
        item.index === fileIndex
          ? {
              ...item,
              partsUploaded: [...new Set([...item.partsUploaded, partNumber])].sort(
                (left, right) => left - right,
              ),
              etags: { ...item.etags, [String(partNumber)]: part.etag },
            }
          : item,
      ),
    });
  }

  return { partNumber, etag: part.etag };
}

export async function completeUpload(
  context: ServiceContext,
  workspaceId: string,
  uploadId: string,
): Promise<UploadSession> {
  const { userId } = await requireModelAction(context, workspaceId, "upload");
  const upload = await requireOpenUpload(context, workspaceId, uploadId);
  const store = new ArtefactStore(context.env);
  const missing = upload.files.filter((file) => file.partsUploaded.length !== file.partCount);

  if (missing.length > 0) {
    throw conflict(`Still waiting for parts of ${missing.map((file) => file.path).join(", ")}`);
  }

  for (const file of upload.files) {
    await store.resumeMultipartUpload(file.key, file.multipartId).complete(
      Array.from({ length: file.partCount }, (_, index) => ({
        partNumber: index + 1,
        etag: file.etags[String(index + 1)],
      })),
    );
  }

  await context.repositories.modelUploads.update(uploadId, { status: "hashing" });
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_upload.completed",
    targetType: "model_upload",
    targetId: uploadId,
  });
  await enqueueFinalise(context.env, context.repositories, { uploadId });

  return toUploadSession({ ...upload, status: "hashing" });
}

export async function abortUpload(
  context: ServiceContext,
  workspaceId: string,
  uploadId: string,
): Promise<UploadSession> {
  await requireModelAction(context, workspaceId, "upload");

  const upload = await requireOpenUpload(context, workspaceId, uploadId);
  const store = new ArtefactStore(context.env);

  for (const file of upload.files) {
    await store.resumeMultipartUpload(file.key, file.multipartId).abort();
  }

  await context.repositories.modelUploads.update(uploadId, { status: "aborted" });

  return toUploadSession({ ...upload, status: "aborted" });
}

export async function getUpload(context: ServiceContext, workspaceId: string, uploadId: string) {
  await requireModelAction(context, workspaceId, "view");

  const upload = await context.repositories.modelUploads.get(workspaceId, uploadId);

  if (!upload) {
    throw notFound("Upload");
  }

  return toUploadSession(upload);
}

async function hashObject(store: ArtefactStore, key: string): Promise<string> {
  const object = await store.get(key);

  if (!object) {
    throw new Error(`${key} is missing`);
  }

  const hash = createHash("sha256");

  for await (const chunk of object.body) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function finishPublish(
  env: IEnv,
  repositories: RepositoryManager,
  upload: ModelUploadRecord,
  versionId: string,
  publishJobId: string,
): Promise<PollOutcome> {
  const hub = await resolveHubAccess(repositories, upload.workspace_id);

  if (!hub) {
    return { status: "error", message: "The Hugging Face connection was removed" };
  }

  const job = await new HuggingFaceJobsClient(hub.namespace, hub.token, fetch).inspect(
    publishJobId,
  );

  if (job.stage === "SCHEDULING" || job.stage === "RUNNING") {
    return PENDING;
  }

  const version = await repositories.modelAssets.getVersionById(versionId);

  if (!version) {
    return { status: "success", message: "Version is gone" };
  }

  if (job.stage !== "COMPLETED") {
    await repositories.modelAssets.updateVersion(versionId, {
      status: "failed",
      failure_reason: job.message ?? "Publishing to the Hub failed",
    });

    return { status: "error", message: job.message ?? "Publishing failed" };
  }

  const repo = readNonEmptyString(job.environment.POLYCHAT_REPOSITORY);

  if (!repo) {
    return { status: "error", message: "The publish job did not record its repository" };
  }

  const client = await workspaceHubClient(repositories, upload.workspace_id);
  const info = await client.getRepoInfo({ kind: "model", repo, revision: "main" });
  const published = await client.listFiles({ kind: "model", repo, revision: info.sha });
  const expected = new Map(upload.files.map((file) => [file.path, file.sha256]));
  const mismatched = published.filter(
    (file) => file.sha256 && expected.has(file.path) && expected.get(file.path) !== file.sha256,
  );

  await repositories.modelAssets.updateVersion(versionId, {
    attributes: { ...version.attributes, location: hubLocation(repo, info.sha) },
  });
  await repositories.modelGovernance.addEvidence([
    {
      versionId,
      kind: "upload_integrity",
      source: "upload",
      status: mismatched.length > 0 ? "fail" : "pass",
      summary:
        mismatched.length > 0
          ? `${mismatched.length} published files do not match the uploaded bytes`
          : `Published to ${repo}@${info.sha.slice(0, 7)} with matching hashes`,
      details: { repo, revision: info.sha, mismatched: mismatched.map((file) => file.path) },
    },
  ]);
  await enqueueInspection(env, repositories, versionId);

  return { status: "success", message: `Published to ${repo}` };
}

export async function finaliseUpload(
  env: IEnv,
  repositories: RepositoryManager,
  data: { uploadId: string; versionId?: string; publishJobId?: string },
): Promise<PollOutcome> {
  const upload = await repositories.modelUploads.getById(data.uploadId);

  if (!upload) {
    return { status: "success", message: "Upload is gone" };
  }

  try {
    if (data.publishJobId && data.versionId) {
      return await finishPublish(env, repositories, upload, data.versionId, data.publishJobId);
    }

    if (upload.status !== "hashing") {
      return { status: "success", message: `Upload is ${upload.status}` };
    }

    const store = new ArtefactStore(env);
    const files: StoredUploadFile[] = [];

    for (const file of upload.files) {
      const head = await store.head(file.key);

      if (!head || head.size !== file.size) {
        throw new Error(`${file.path} is ${head?.size ?? 0} bytes, expected ${file.size}`);
      }

      files.push({ ...file, sha256: await hashObject(store, file.key) });
    }

    await repositories.modelUploads.update(upload.id, {
      status: "ready",
      files,
      failure_reason: null,
    });

    return { status: "success", message: "Hashed" };
  } catch (error) {
    const reason = getErrorMessage(error, "Finalising failed");

    await repositories.modelUploads.update(upload.id, { status: "failed", failure_reason: reason });

    return { status: "error", message: reason };
  }
}

export async function registerUploadedModel(
  context: ServiceContext,
  workspaceId: string,
  input: RegisterUploadedModelRequest,
): Promise<VersionDetail> {
  const { userId } = await requireModelAction(context, workspaceId, "upload");
  const request = registerUploadedModelRequestSchema.parse(input);
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const repositories = context.repositories;
  const upload = await repositories.modelUploads.get(workspaceId, request.uploadId);

  if (!upload || upload.status !== "ready" || upload.purpose === "dataset" || upload.consumed_by) {
    throw conflict("Finish a weights upload before registering it");
  }

  if (upload.purpose !== request.kind) {
    throw badRequest(`This upload was started as a ${upload.purpose}`);
  }

  if (request.kind === "adapter") {
    const base = request.baseVersionId
      ? await repositories.modelAssets.getVersion(workspaceId, request.baseVersionId)
      : null;
    const baseAsset = base
      ? await repositories.modelAssets.getAsset(workspaceId, base.asset_id)
      : null;

    if (!baseAsset || baseAsset.kind !== "model") {
      throw badRequest("Choose the base model this adapter was trained on");
    }
  }

  const paths = upload.files.map((file) => file.path);
  const revision = await sha256Hex(
    upload.files
      .map((file) => `${file.path}:${file.sha256}`)
      .sort()
      .join("\n"),
  );
  const asset = await repositories.modelAssets.createAsset({
    workspaceId,
    kind: request.kind,
    source: "upload",
    sourceRef: `upload/${slugify(upload.name, 80)}`,
    displayName: upload.name,
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
    status: "importing",
    createdBy: userId,
    attributes: {
      licence: normaliseLicence(request.licence),
      formats: collectWeightFormats(paths),
      parameterCount: null,
      gated: false,
      remoteCode: false,
      pipelineTag: "text-generation",
      libraryName: request.kind === "adapter" ? "peft" : "transformers",
      tags: ["upload", ...(projectId ? [`project:${projectId}`] : [])],
      baseModels: [],
      totalBytes: upload.files.reduce((sum, file) => sum + file.size, 0),
      trainingComputeFlops: null,
      architecture: null,
      location: null,
    },
    files: upload.files.map((file) => ({
      path: file.path,
      size: file.size,
      sha256: file.sha256,
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

  await repositories.modelUploads.update(upload.id, { consumed_by: version.id });
  await repositories.modelGovernance.addEvidence([
    {
      versionId: version.id,
      kind: "provenance",
      source: "upload",
      status: "warn",
      summary: `Uploaded by a workspace member: ${request.provenance.slice(0, 200)}`,
      details: {
        provenance: request.provenance,
        intendedUse: request.intendedUse,
        uploadId: upload.id,
      },
    },
  ]);
  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_version.uploaded",
    targetType: "model_version",
    targetId: version.id,
    metadata: { uploadId: upload.id, kind: request.kind, revision, licence: request.licence },
  });

  const hub = await resolveHubAccess(repositories, workspaceId);

  if (hub) {
    const store = new ArtefactStore(context.env);
    const job = await startHubPublishJob({
      namespace: hub.namespace,
      token: hub.token,
      fetcher: fetch,
      repository: `${hub.namespace}/${slugify(`polychat-${upload.name}`, 90)}`,
      repoType: "model",
      files: await Promise.all(
        upload.files.map(async (file) => ({
          path: file.path,
          url: await store.presign(file.key, "GET", PRESIGN_SECONDS),
        })),
      ),
      message: `Upload ${revision.slice(0, 12)} from Polychat`,
      label: upload.id,
    });

    await enqueueFinalise(context.env, repositories, {
      uploadId: upload.id,
      versionId: version.id,
      publishJobId: job.id,
    });
  } else {
    await repositories.modelAssets.updateVersion(version.id, { status: "ready" });
    await repositories.modelGovernance.addEvidence([
      {
        versionId: version.id,
        kind: "upload_integrity",
        source: "upload",
        status: "pass",
        summary: "Hashed on arrival; connect Hugging Face to publish and serve it",
        details: { files: upload.files.map((file) => ({ path: file.path, sha256: file.sha256 })) },
      },
    ]);
    await syncVersionReviews(repositories, workspaceId, version.id);
  }

  return getVersionDetail(context, workspaceId, version.id);
}
