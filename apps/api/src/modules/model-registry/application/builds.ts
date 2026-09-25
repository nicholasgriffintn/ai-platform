import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  assessModificationCompute,
  assessPiiSample,
  detectWeightFormat,
  estimateTrainingFlops,
} from "@ngriffin_uk/polychat-library-model-registry";
import type {
  ModelBuild,
  StartBuildRequest,
  TrainingModelDefinition,
} from "@ngriffin_uk/polychat-schemas";
import {
  getErrorMessage,
  isGitCommitSha,
  sha256Hex,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { exportTrainingExamplesToS3 } from "~/infrastructure/providers/capabilities/training/exportDataset";
import {
  getTrainingWorkerJob,
  startTrainingWorkerJob,
} from "~/modules/training/infrastructure/trainingWorkerClient";
import type { IEnv } from "~/types";

import type { ModelVersionRecord } from "../infrastructure/ModelAssetRepository";
import type { ModelBuildRecord } from "../infrastructure/ModelBuildRepository";
import { requireRegistryMember, requireWorkspaceProject } from "./access";
import { requireTrainingCredentials, resolveEndpointCredentials } from "./credentials";
import { syncVersionReviews } from "./decisions";
import { workspaceHubClient } from "./hub";
import { enqueueInspection } from "./importing";
import { requireUsableVersion } from "./scope";

const logger = getLogger({ prefix: "modules/model-registry/builds" });

const ESTIMATED_CHARS_PER_TOKEN = 4;
const PII_SAMPLE_ROWS = 200;
const PENDING_REVISION_PREFIX = "pending:";

function exampleText(example: Record<string, unknown>): string {
  return [example.system_prompt, example.user_prompt, example.assistant_response]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join("\n");
}

function toModelBuild(
  record: ModelBuildRecord,
  version: ModelVersionRecord | undefined,
): ModelBuild {
  const flops = version?.attributes.trainingComputeFlops ?? null;

  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    versionId: record.version_id,
    baseVersionId: record.base_version_id,
    datasetVersionId: record.dataset_version_id,
    provider: record.provider,
    jobName: record.job_name,
    recipe: record.recipe,
    status: record.status,
    failureReason: record.failure_reason,
    createdAt: record.created_at,
    completedAt: record.completed_at,
    compute:
      flops === null
        ? null
        : assessModificationCompute({ modificationFlops: flops, baseTrainingFlops: null }),
  };
}

async function snapshotTrainingExamples(
  context: ServiceContext,
  workspaceId: string,
  request: StartBuildRequest,
  userId: number,
) {
  const repositories = context.repositories;
  const filters = {
    userId,
    includeInTraining: true,
    minFeedbackRating: request.minFeedbackRating,
    minQualityScore: request.minQualityScore,
    limit: request.exampleLimit,
  };
  const examples = await repositories.trainingExamples.findMany(filters);

  if (examples.length === 0) {
    throw new AssistantError(
      "No training examples matched these filters",
      ErrorType.NOT_FOUND,
      404,
    );
  }

  const texts = examples.map(exampleText);
  const revision = await sha256Hex(
    examples
      .map((example) => String(example.id))
      .sort()
      .join(","),
  );
  const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
  const asset = await repositories.modelAssets.createAsset({
    workspaceId,
    kind: "dataset",
    source: "derived",
    sourceRef: `polychat/training-examples/user-${userId}`,
    displayName: "Rated conversations",
    createdBy: userId,
  });
  const existing = await repositories.modelAssets.findVersion(asset.id, revision);
  const version =
    existing ??
    (await repositories.modelAssets.createVersion({
      assetId: asset.id,
      workspaceId,
      revision,
      status: "ready",
      createdBy: userId,
      attributes: {
        licence: "internal",
        formats: [],
        parameterCount: null,
        gated: false,
        remoteCode: false,
        pipelineTag: null,
        libraryName: null,
        tags: ["polychat-feedback"],
        baseModels: [],
        totalBytes: totalChars,
        trainingComputeFlops: null,
      },
      files: [],
    }));

  if (!existing) {
    const pii = assessPiiSample(texts.slice(0, PII_SAMPLE_ROWS));

    await repositories.modelGovernance.addEvidence([
      {
        versionId: version.id,
        kind: "format",
        source: "static_inspection",
        status: "pass",
        summary: `${examples.length} conversations in chat message format`,
      },
      {
        versionId: version.id,
        kind: "licence",
        source: "static_inspection",
        status: "pass",
        summary: "Workspace-owned conversation data",
      },
      {
        versionId: version.id,
        kind: "dataset_stats",
        source: "static_inspection",
        status: "pass",
        summary: `${examples.length} rows, about ${Math.round(totalChars / ESTIMATED_CHARS_PER_TOKEN).toLocaleString("en-GB")} tokens`,
        details: { rows: examples.length, characters: totalChars, filters },
      },
      {
        versionId: version.id,
        kind: "pii",
        source: "static_inspection",
        status: pii.status,
        summary: `${pii.rowsWithPii} of ${pii.rowsSampled} sampled rows contain personal data patterns`,
        details: { ...pii },
      },
    ]);
    await syncVersionReviews(repositories, workspaceId, version.id);
  }

  return { version, filters, examples: examples.length, totalChars };
}

export async function startBuild(
  context: ServiceContext,
  workspaceId: string,
  request: StartBuildRequest,
): Promise<ModelBuild> {
  const { userId } = await requireRegistryMember(context, workspaceId);
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const repositories = context.repositories;
  const credentials = await requireTrainingCredentials(context.env, repositories, workspaceId);
  const base = await requireUsableVersion(
    repositories,
    workspaceId,
    projectId,
    request.baseVersionId,
    "Base model",
  );
  const baseAsset = await repositories.modelAssets.getAsset(workspaceId, base.asset_id);

  if (!baseAsset || baseAsset.kind !== "model" || !isGitCommitSha(base.revision)) {
    throw new AssistantError(
      "Only Hugging Face models pinned to a commit can be fine-tuned",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const dataset = await snapshotTrainingExamples(context, workspaceId, request, userId);

  await requireUsableVersion(
    repositories,
    workspaceId,
    projectId,
    dataset.version.id,
    "Training dataset",
  );

  const exported = await exportTrainingExamplesToS3({
    context,
    filters: {
      minFeedbackRating: request.minFeedbackRating,
      minQualityScore: request.minQualityScore,
      limit: request.exampleLimit,
    },
  });
  const jobName = slugify(`${baseAsset.display_name}-ft-${Date.now().toString(36)}`, 60);
  const model: TrainingModelDefinition = {
    id: base.id,
    provider: "huggingface",
    family: "huggingface",
    name: baseAsset.display_name,
    baseModel: baseAsset.source_ref,
    baseModelRevision: base.revision,
    registryVersionId: base.id,
    defaultHyperparameters: base.attributes.remoteCode ? { trust_remote_code: "True" } : {},
  };
  const job = await startTrainingWorkerJob(
    context.env,
    {
      provider: "huggingface",
      modelId: base.id,
      jobName,
      dataset: { trainS3Uri: exported.s3Uri },
      hyperparameters: { EPOCHS: request.epochs },
      instanceType: request.flavor,
      recipe: request.recipe,
      model,
      requestId: context.requestId,
    },
    userId,
    credentials,
  );

  if (job.status === "Failed" || !job.outputModelRepository) {
    throw new AssistantError(
      `The training job could not start: ${job.failureReason ?? "no output repository reported"}`,
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const tokens = (dataset.totalChars / ESTIMATED_CHARS_PER_TOKEN) * request.epochs;
  const derivedAsset = await repositories.modelAssets.createAsset({
    workspaceId,
    kind: "model",
    source: "derived",
    sourceRef: job.outputModelRepository,
    displayName: jobName,
    createdBy: userId,
  });
  const derived = await repositories.modelAssets.createVersion({
    assetId: derivedAsset.id,
    workspaceId,
    revision: `${PENDING_REVISION_PREFIX}${jobName}`,
    status: "importing",
    createdBy: userId,
    attributes: {
      ...base.attributes,
      baseModels: [baseAsset.source_ref],
      tags: ["polychat-build", request.recipe],
      trainingComputeFlops:
        base.attributes.parameterCount === null
          ? null
          : estimateTrainingFlops(base.attributes.parameterCount, tokens),
    },
    files: [],
  });

  await repositories.modelAssets.addLineageEdge({
    fromVersionId: base.id,
    toVersionId: derived.id,
    relation: "fine_tuned_from",
  });
  await repositories.modelAssets.addLineageEdge({
    fromVersionId: dataset.version.id,
    toVersionId: derived.id,
    relation: "trained_on",
  });

  const build = await repositories.modelBuilds.createBuild({
    workspaceId,
    projectId,
    versionId: derived.id,
    baseVersionId: base.id,
    datasetVersionId: dataset.version.id,
    provider: "huggingface",
    jobName,
    recipe: request.recipe,
    createdBy: userId,
  });

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_build.started",
    targetType: "model_build",
    targetId: build.id,
    metadata: {
      baseVersionId: base.id,
      datasetVersionId: dataset.version.id,
      derivedVersionId: derived.id,
      jobName,
      recipe: request.recipe,
      examples: dataset.examples,
    },
  });

  return toModelBuild(build, derived);
}

export async function listBuilds(
  context: ServiceContext,
  workspaceId: string,
  projectIdInput?: string,
): Promise<{ builds: ModelBuild[] }> {
  await requireRegistryMember(context, workspaceId);

  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);
  const builds = await context.repositories.modelBuilds.listBuilds(workspaceId, projectId);
  const versions = await context.repositories.modelAssets.listVersions(
    workspaceId,
    builds.map((build) => build.version_id),
  );
  const byId = new Map(versions.map((version) => [version.id, version]));

  return { builds: builds.map((build) => toModelBuild(build, byId.get(build.version_id))) };
}

async function finishBuild(env: IEnv, repositories: RepositoryManager, build: ModelBuildRecord) {
  if (!build.created_by) {
    return;
  }

  const job = await getTrainingWorkerJob(
    env,
    build.provider,
    build.job_name,
    build.created_by,
    await resolveEndpointCredentials(env, repositories, build.workspace_id),
  );

  if (job.status === "Failed" || job.status === "Cancelled") {
    const reason = job.failureReason ?? `Training job ${job.status.toLowerCase()}`;

    await repositories.modelBuilds.finish(build.id, "failed", reason);
    await repositories.modelAssets.updateVersion(build.version_id, {
      status: "failed",
      failure_reason: reason,
    });

    return;
  }

  if (job.status !== "Completed" || !job.outputModelRepository) {
    return;
  }

  const version = await repositories.modelAssets.getVersionById(build.version_id);

  if (!version) {
    return;
  }

  const hub = await workspaceHubClient(env, repositories, build.workspace_id);
  const reference = { kind: "model" as const, repo: job.outputModelRepository, revision: "main" };
  const info = await hub.getRepoInfo(reference);
  const files = await hub.listFiles({ ...reference, revision: info.sha });

  await repositories.modelAssets.finaliseRevision(version.id, {
    revision: info.sha,
    attributes: {
      ...version.attributes,
      parameterCount: info.parameterCount ?? version.attributes.parameterCount,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    },
    files: files.map((file) => ({
      path: file.path,
      size: file.size,
      sha256: file.sha256,
      format: detectWeightFormat(file.path),
    })),
  });
  await repositories.modelBuilds.finish(build.id, "completed", null);
  await repositories.audit.createRecord({
    workspaceId: build.workspace_id,
    actorUserId: null,
    action: "model_build.completed",
    targetType: "model_build",
    targetId: build.id,
    metadata: { versionId: version.id, revision: info.sha, repository: job.outputModelRepository },
  });
  await enqueueInspection(env, repositories, version.id);
}

export async function syncRunningBuilds(
  env: IEnv,
  repositories: RepositoryManager,
): Promise<number> {
  const running = await repositories.modelBuilds.listRunning();

  for (const build of running) {
    try {
      await finishBuild(env, repositories, build);
    } catch (error) {
      logger.warn("Build sync failed", {
        buildId: build.id,
        error: getErrorMessage(error, "Unknown error"),
      });
    }
  }

  return running.length;
}
