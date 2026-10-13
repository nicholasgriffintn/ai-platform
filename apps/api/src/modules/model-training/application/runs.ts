import { trainerManifest } from "@ngriffin_uk/polychat-ai-model-providers";
import {
  estimateTrainingCost,
  trainingMemoryBytes,
  trainingTokens,
} from "@ngriffin_uk/polychat-library-model-registry";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  ACTIVE_TRAINING_RUN_STATUSES,
  MODEL_TRAINING_SYNC_TASK_TYPE,
  type StartTrainingRunRequest,
  startTrainingRunRequestSchema,
  type TrainingMetricPoint,
  type TrainingRun,
  type TrainingRunsResponse,
  type TrainingStartResult,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, readRecord, sha256Hex, slugify } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { requireHubAccess } from "~/modules/model-governance/application/connections";
import { preflightWorkspaceSpend } from "~/modules/model-governance/application/spend";
import { recordSpendRequest } from "~/modules/model-governance/application/spend-requests";
import {
  badRequest,
  conflict,
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "~/modules/model-registry/application/access";
import { requireUsableVersion } from "~/modules/model-registry/application/scope";
import { ArtefactStore, artefactKeys } from "~/modules/model-registry/infrastructure/ArtefactStore";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import type { ModelTrainingRunRecord } from "../infrastructure/ModelTrainingRepository";
import { loadTrainingInputs, METHOD_SHAPES, modificationCompute } from "./plan";

export function toTrainingRun(
  record: ModelTrainingRunRecord,
  metrics: TrainingMetricPoint[] = [],
  checkpoints: TrainingRun["checkpoints"] = [],
): TrainingRun {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    spec: record.spec,
    specHash: record.spec_hash,
    status: record.status,
    providerJobId: record.provider_job_id,
    outputVersionId: record.output_version_id,
    datasetVersionIds: record.dataset_version_ids,
    estimate: record.estimate,
    costUsd: record.cost_usd,
    compute: record.compute,
    metrics,
    checkpoints,
    failureReason: record.failure_reason,
    createdBy: record.created_by,
    createdAt: record.created_at,
    startedAt: record.started_at,
    completedAt: record.completed_at,
  };
}

export async function enqueueTrainingSync(
  env: IEnv,
  repositories: RepositoryManager,
  runId: string,
) {
  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${MODEL_TRAINING_SYNC_TASK_TYPE}:${runId}:${Date.now()}`,
    task_type: MODEL_TRAINING_SYNC_TASK_TYPE,
    task_data: { runId },
    priority: 5,
  });
}

interface PreparedRun {
  request: ReturnType<typeof startTrainingRunRequestSchema.parse>;
  projectId: string | null;
  outputRepository: string | null;
  datasetVersionIds: string[];
  estimate: ModelTrainingRunRecord["estimate"];
  compute: ModelTrainingRunRecord["compute"];
}

async function prepareRun(
  context: ServiceContext,
  workspaceId: string,
  input: StartTrainingRunRequest,
): Promise<PreparedRun> {
  const request = startTrainingRunRequestSchema.parse(input);
  const { spec } = request;
  const repositories = context.repositories;
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const trainer = trainerManifest(spec.target.provider, spec.target.target);

  if (!trainer.methods.includes(spec.method)) {
    throw badRequest(`${trainer.name} does not offer ${spec.method.replace(/_/g, " ")}`);
  }

  if (!trainer.adaptations.includes(spec.adaptation)) {
    throw badRequest(`${trainer.name} does not offer ${spec.adaptation} training`);
  }

  const connection = await repositories.modelConnections.getConnection(
    workspaceId,
    spec.target.provider,
  );

  if (!connection?.capabilities.train) {
    throw conflict("Connect this provider with training rights under Models › Governance first");
  }

  const base = await requireUsableVersion(
    repositories,
    workspaceId,
    projectId,
    spec.baseVersionId,
    "Base model",
  );

  for (const versionId of spec.mergeVersionIds) {
    await requireUsableVersion(repositories, workspaceId, projectId, versionId, "Merge input");
  }

  const datasetVersionIds = [spec.trainDatasetVersionId, spec.validationDatasetVersionId].filter(
    (id): id is string => id !== null,
  );

  for (const versionId of datasetVersionIds) {
    await requireUsableVersion(repositories, workspaceId, projectId, versionId, "Dataset");
  }

  const shapes = METHOD_SHAPES[spec.method];
  const inputs = await loadTrainingInputs(
    repositories,
    workspaceId,
    spec.trainDatasetVersionId,
    spec.graderId,
  );

  if (shapes.length > 0) {
    if (!inputs.datasetShape || !shapes.includes(inputs.datasetShape)) {
      throw badRequest(
        `${spec.method.replace(/_/g, " ")} needs a ${shapes.join(" or ").replace(/_/g, " ")} dataset`,
      );
    }

    if (!trainer.datasetShapes.includes(inputs.datasetShape)) {
      throw badRequest(
        `${trainer.name} does not accept ${inputs.datasetShape.replace(/_/g, " ")} datasets`,
      );
    }
  }

  if (spec.method === "rft") {
    if (!inputs.graderKind) {
      throw badRequest("Reinforcement fine-tuning needs a grader for its reward");
    }

    if (!trainer.graderKinds.includes(inputs.graderKind)) {
      throw badRequest(`${trainer.name} cannot use ${inputs.graderKind} graders as a reward`);
    }
  }

  if (spec.method === "merge" && spec.mergeVersionIds.length === 0) {
    throw badRequest("Choose the adapters or models to merge");
  }

  const hardware = spec.target.hardware
    ? trainer.hardware.find((item) => item.id === spec.target.hardware)
    : null;

  if (spec.target.hardware && !hardware) {
    throw badRequest(`${trainer.name} has no hardware option ${spec.target.hardware}`);
  }

  const memory = trainingMemoryBytes(base.attributes.parameterCount, spec.adaptation);

  if (hardware && memory !== null && hardware.memoryGb * 1024 ** 3 * 0.9 < memory) {
    throw badRequest(
      `${hardware.label} is too small; this run needs about ${Math.ceil(memory / 1024 ** 3)} GB`,
    );
  }

  const tokens = trainingTokens({
    method: spec.method,
    datasetTokens: inputs.datasetTokens,
    epochs: spec.hyperparameters.epochs,
    generationsPerPrompt: spec.hyperparameters.generationsPerPrompt,
  });
  const outputRepository =
    trainer.output === "hub" || spec.target.provider === "huggingface"
      ? `${(await requireHubAccess(repositories, workspaceId)).namespace}/${slugify(spec.outputName, 90)}`
      : null;

  return {
    request,
    projectId,
    outputRepository,
    datasetVersionIds,
    estimate: estimateTrainingCost({
      trainer,
      hardware: hardware ?? trainer.hardware[0] ?? null,
      parameterCount: base.attributes.parameterCount,
      tokens,
      adaptation: spec.adaptation,
      method: spec.method,
    }),
    compute: modificationCompute(base.attributes.parameterCount, tokens, null),
  };
}

async function startPreparedRun(
  env: IEnv,
  repositories: RepositoryManager,
  workspaceId: string,
  userId: number,
  prepared: PreparedRun,
): Promise<TrainingRun> {
  const { spec } = prepared.request;
  const run = await repositories.modelTraining.create({
    workspaceId,
    projectId: prepared.projectId,
    spec,
    specHash: await sha256Hex(canonicalJson(spec)),
    provider: spec.target.provider,
    trainer: spec.target.target,
    outputRepository: prepared.outputRepository,
    datasetVersionIds: prepared.datasetVersionIds,
    estimate: prepared.estimate,
    compute: prepared.compute,
    createdBy: userId,
  });

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_training.started",
    targetType: "model_training_run",
    targetId: run.id,
    metadata: { spec, estimate: prepared.estimate, outputRepository: prepared.outputRepository },
  });
  await enqueueTrainingSync(env, repositories, run.id);

  return toTrainingRun(run);
}

export async function startTrainingRun(
  context: ServiceContext,
  workspaceId: string,
  input: StartTrainingRunRequest,
): Promise<TrainingStartResult> {
  const access = await requireModelAction(context, workspaceId, "train");
  const prepared = await prepareRun(context, workspaceId, input);
  const preflight = await preflightWorkspaceSpend(
    context.repositories,
    workspaceId,
    prepared.projectId,
    prepared.estimate.usd,
  );

  if (preflight.decision === "blocked") {
    throw conflict(preflight.reason ?? "This run would break the budget");
  }

  const isAuthorised = authorise("spend.authorise", {
    required: preflight.decision === "needs_approval",
    approved: false,
    canApprove: access.actions.has("approve"),
    separationOfDuties: access.separationOfDuties,
  }).allowed;

  if (!isAuthorised) {
    return {
      run: null,
      preflight,
      spendRequest: await recordSpendRequest(context.repositories, {
        workspaceId,
        projectId: prepared.projectId,
        subjectType: "training_run",
        payload: { ...prepared.request },
        estimateUsd: prepared.estimate.usd,
        reason: preflight.reason,
        requestedBy: access.userId,
      }),
    };
  }

  return {
    run: await startPreparedRun(
      context.env,
      context.repositories,
      workspaceId,
      access.userId,
      prepared,
    ),
    preflight,
    spendRequest: null,
  };
}

export async function startApprovedRun(
  context: ServiceContext,
  workspaceId: string,
  requestedBy: number,
  payload: Record<string, unknown>,
): Promise<TrainingRun> {
  const prepared = await prepareRun(
    context,
    workspaceId,
    startTrainingRunRequestSchema.parse(payload),
  );
  const preflight = await preflightWorkspaceSpend(
    context.repositories,
    workspaceId,
    prepared.projectId,
    prepared.estimate.usd,
  );

  if (preflight.decision === "blocked") {
    throw conflict(preflight.reason ?? "This run would break the budget");
  }

  return startPreparedRun(context.env, context.repositories, workspaceId, requestedBy, prepared);
}

export async function listTrainingRuns(
  context: ServiceContext,
  workspaceId: string,
  projectIdInput?: string,
): Promise<TrainingRunsResponse> {
  await requireModelAction(context, workspaceId, "view");

  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);
  const runs = await context.repositories.modelTraining.list(workspaceId, projectId);
  const versions = await context.repositories.modelAssets.listVersions(
    workspaceId,
    runs.map((run) => run.spec.baseVersionId),
  );
  const assets = new Map(
    (await context.repositories.modelAssets.listAssets(workspaceId)).map((asset) => [
      asset.id,
      asset,
    ]),
  );
  const store = new ArtefactStore(context.env);

  return {
    runs: await Promise.all(
      runs.map(async (run) => {
        const version = versions.find((item) => item.id === run.spec.baseVersionId);
        const metrics = run.status === "running" ? await readRunMetrics(store, run) : [];

        return {
          ...toTrainingRun(run),
          baseName: (version && assets.get(version.asset_id)?.display_name) ?? "Unknown base",
          latestLoss:
            [...metrics].reverse().find((point) => point.trainLoss !== null)?.trainLoss ?? null,
        };
      }),
    ),
  };
}

export async function readRunMetrics(
  store: ArtefactStore,
  run: ModelTrainingRunRecord,
): Promise<TrainingMetricPoint[]> {
  const report = readRecord(await store.readJson(artefactKeys.runReport(run.workspace_id, run.id)));
  const providerReport = readRecord(
    await store.readJson(artefactKeys.runReport(run.workspace_id, `${run.id}-provider`)),
  );
  const points = [
    ...(Array.isArray(report.metrics) ? report.metrics : []),
    ...(Array.isArray(providerReport.metrics) ? providerReport.metrics : []),
  ];

  return points
    .map((point) => readRecord(point))
    .map((point) => ({
      step: typeof point.step === "number" ? point.step : 0,
      epoch: typeof point.epoch === "number" ? point.epoch : null,
      trainLoss: typeof point.trainLoss === "number" ? point.trainLoss : null,
      validLoss: typeof point.validLoss === "number" ? point.validLoss : null,
      reward: typeof point.reward === "number" ? point.reward : null,
      learningRate: typeof point.learningRate === "number" ? point.learningRate : null,
    }))
    .sort((left, right) => left.step - right.step);
}

export async function getTrainingRun(
  context: ServiceContext,
  workspaceId: string,
  runId: string,
): Promise<TrainingRun> {
  await requireModelAction(context, workspaceId, "view");

  const run = await context.repositories.modelTraining.get(workspaceId, runId);

  if (!run) {
    throw notFound("Training run");
  }

  const checkpoints = await context.repositories.modelTraining.listCheckpoints(run.id);

  return toTrainingRun(
    run,
    await readRunMetrics(new ArtefactStore(context.env), run),
    checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      step: checkpoint.step,
      providerRef: checkpoint.provider_ref,
      versionId: checkpoint.version_id,
      metrics: checkpoint.metrics,
      createdAt: checkpoint.created_at,
    })),
  );
}

export async function cancelTrainingRun(
  context: ServiceContext,
  workspaceId: string,
  runId: string,
): Promise<TrainingRun> {
  const { userId } = await requireModelAction(context, workspaceId, "train");
  const repositories = context.repositories;
  const run = await repositories.modelTraining.get(workspaceId, runId);

  if (!run) {
    throw notFound("Training run");
  }

  if (!ACTIVE_TRAINING_RUN_STATUSES.includes(run.status)) {
    throw conflict(`The run is already ${run.status}`);
  }

  const cancelled = await repositories.modelTraining.requestCancellation(workspaceId, run.id);

  if (!cancelled) {
    throw conflict("The run finished before cancellation could be requested");
  }

  if (cancelled.status === "cancelling") {
    await enqueueTrainingSync(context.env, repositories, run.id);
  } else {
    await repositories.modelTraining.update(run.id, { completed_at: new Date().toISOString() });
  }

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_training.cancelled",
    targetType: "model_training_run",
    targetId: run.id,
  });

  return getTrainingRun(context, workspaceId, runId);
}
