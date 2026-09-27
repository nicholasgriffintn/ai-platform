import {
  type DatasetHandle,
  outputKind,
  readReportedState,
  type TrainingJobState,
  type TrainingOutput,
  type TrainingSubmission,
} from "@ngriffin_uk/polychat-ai-model-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { PENDING, type PollOutcome } from "@ngriffin_uk/polychat-ai-workflows";
import {
  collectWeightFormats,
  detectWeightFormat,
} from "@ngriffin_uk/polychat-library-model-registry";
import type {
  DatasetStats,
  LineageRelation,
  TrainingRunStatus,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { workspaceHubClient } from "~/modules/model-governance/application/connections";
import { assertProviderCreationPending } from "~/modules/model-governance/application/provider-creation";
import { toAssistantError } from "~/modules/model-governance/application/provider-errors";
import { syncVersionReviews } from "~/modules/model-registry/application/decisions";
import { buildModelHandle, providerLocation } from "~/modules/model-registry/application/handles";
import { enqueueInspection } from "~/modules/model-registry/application/importing";
import { requireUsableVersion } from "~/modules/model-registry/application/scope";
import { ArtefactStore, artefactKeys } from "~/modules/model-registry/infrastructure/ArtefactStore";
import type { IEnv } from "~/types";

import type { ModelTrainingRunRecord } from "../infrastructure/ModelTrainingRepository";
import { preserveTrainingInputWithdrawals } from "./output-governance";
import { cancelProviderJob, trainerFor } from "./trainer-context";

const logger = getLogger({ prefix: "modules/model-training/sync" });

const PRESIGN_SECONDS = 7 * 24 * 60 * 60;
const TERMINAL: ReadonlySet<TrainingRunStatus> = new Set(["completed", "failed", "cancelled"]);

async function datasetHandle(
  env: IEnv,
  repositories: RepositoryManager,
  workspaceId: string,
  versionId: string,
  split: "train" | "validation",
): Promise<DatasetHandle | null> {
  const profile = await repositories.modelDatasets.get(versionId);
  const stats: DatasetStats = profile?.stats ?? {};
  const splitStats = stats.splits?.find((item) => item.name === split);

  if (
    !profile ||
    profile.workspace_id !== workspaceId ||
    profile.status !== "ready" ||
    !splitStats ||
    splitStats.rows === 0
  ) {
    return null;
  }

  const store = new ArtefactStore(env);
  const key = artefactKeys.datasetSplit(workspaceId, versionId, split);
  const head = await store.head(key);
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);
  const asset = version
    ? await repositories.modelAssets.getAsset(workspaceId, version.asset_id)
    : null;

  if (!head) {
    throw new Error(`Dataset split ${split} is missing from storage`);
  }

  return {
    versionId,
    name: asset?.display_name ?? versionId,
    shape: profile.shape,
    rows: splitStats.rows,
    tokens: splitStats.tokens,
    file: {
      url: await store.presign(key, "GET", PRESIGN_SECONDS),
      size: head.size,
      sha256: null,
      filename: `${versionId}-${split}.jsonl`,
      open: async () => {
        const object = await store.get(key);

        if (!object) {
          throw new Error(`Dataset split ${split} disappeared`);
        }

        return object.body;
      },
    },
  };
}

async function buildSubmission(
  env: IEnv,
  repositories: RepositoryManager,
  run: ModelTrainingRunRecord,
): Promise<TrainingSubmission> {
  const { spec } = run;
  const workspaceId = run.workspace_id;
  const grader = spec.graderId
    ? await repositories.modelGraders.get(workspaceId, spec.graderId)
    : null;
  const train = spec.trainDatasetVersionId
    ? await datasetHandle(env, repositories, workspaceId, spec.trainDatasetVersionId, "train")
    : null;
  const validation = spec.validationDatasetVersionId
    ? await datasetHandle(env, repositories, workspaceId, spec.validationDatasetVersionId, "train")
    : spec.trainDatasetVersionId
      ? await datasetHandle(
          env,
          repositories,
          workspaceId,
          spec.trainDatasetVersionId,
          "validation",
        )
      : null;

  return {
    runId: run.id,
    spec,
    base: await buildModelHandle(repositories, workspaceId, spec.baseVersionId),
    merge: await Promise.all(
      spec.mergeVersionIds.map((versionId) =>
        buildModelHandle(repositories, workspaceId, versionId),
      ),
    ),
    train,
    validation,
    grader: grader ? { id: grader.id, metric: grader.metric, config: grader.config } : null,
    outputRepository: run.output_repository ?? `polychat/${run.id}`,
    reportUrl: await new ArtefactStore(env).presign(
      artefactKeys.runReport(workspaceId, run.id),
      "PUT",
      PRESIGN_SECONDS,
    ),
  };
}

function lineageRelation(run: ModelTrainingRunRecord): LineageRelation {
  switch (run.spec.method) {
    case "quantise":
      return "quantised_from";
    case "merge":
      return "merged_from";
    case "distillation":
      return "distilled_from";
    default:
      return outputKind(run.spec) === "adapter" ? "adapter_of" : "fine_tuned_from";
  }
}

async function registerOutput(
  repositories: RepositoryManager,
  env: IEnv,
  run: ModelTrainingRunRecord,
  output: TrainingOutput,
): Promise<string> {
  const workspaceId = run.workspace_id;
  const base = await repositories.modelAssets.getVersion(workspaceId, run.spec.baseVersionId);

  if (!base) {
    throw new Error("The base version is gone");
  }

  const kind = outputKind(run.spec);
  const attributes = {
    ...base.attributes,
    baseModels: [base.id],
    tags: ["polychat-run", run.spec.method, run.spec.adaptation],
    trainingComputeFlops: run.compute?.modificationFlops ?? null,
    gated: false,
  };
  let versionId: string;

  if (output.kind === "hub") {
    const hub = await workspaceHubClient(repositories, workspaceId);
    const info = await hub.getRepoInfo({
      kind: "model",
      repo: output.repo,
      revision: output.revision,
    });
    const files = await hub.listFiles({ kind: "model", repo: output.repo, revision: info.sha });
    const asset = await repositories.modelAssets.createAsset({
      workspaceId,
      kind,
      source: "derived",
      sourceRef: output.repo,
      displayName: run.spec.outputName,
      createdBy: run.created_by,
    });
    const version =
      (await repositories.modelAssets.findVersion(asset.id, info.sha)) ??
      (await repositories.modelAssets.createVersion({
        assetId: asset.id,
        workspaceId,
        revision: info.sha,
        status: "inspecting",
        createdBy: run.created_by,
        attributes: {
          ...attributes,
          formats: collectWeightFormats(files.map((file) => file.path)),
          totalBytes: files.reduce((sum, file) => sum + file.size, 0),
          location: null,
        },
        files: files
          .filter((file) => !file.path.startsWith("checkpoints/"))
          .map((file) => ({
            path: file.path,
            size: file.size,
            sha256: file.sha256,
            format: detectWeightFormat(file.path),
          })),
      }));

    versionId = version.id;
    await enqueueInspection(env, repositories, version.id);
  } else {
    const asset = await repositories.modelAssets.createAsset({
      workspaceId,
      kind,
      source: "provider",
      sourceRef: `${output.provider}/${output.ref}`,
      displayName: run.spec.outputName,
      createdBy: run.created_by,
    });
    const version =
      (await repositories.modelAssets.findVersion(asset.id, output.ref)) ??
      (await repositories.modelAssets.createVersion({
        assetId: asset.id,
        workspaceId,
        revision: output.ref,
        status: "ready",
        createdBy: run.created_by,
        attributes: { ...attributes, location: providerLocation(output.provider, output.ref) },
        files: [],
      }));

    versionId = version.id;
  }

  await repositories.modelAssets.addLineageEdge({
    fromVersionId: base.id,
    toVersionId: versionId,
    relation: lineageRelation(run),
  });

  for (const mergedId of run.spec.mergeVersionIds) {
    await repositories.modelAssets.addLineageEdge({
      fromVersionId: mergedId,
      toVersionId: versionId,
      relation: "merged_from",
    });
  }

  for (const datasetId of run.dataset_version_ids) {
    await repositories.modelAssets.addLineageEdge({
      fromVersionId: datasetId,
      toVersionId: versionId,
      relation: "trained_on",
    });
  }

  await repositories.modelGovernance.addEvidence([
    {
      versionId,
      kind: "provenance",
      source: "provider",
      status: "pass",
      summary: `Trained by Polychat run ${run.id} on ${run.provider} (${run.spec.method}, ${run.spec.adaptation})`,
      details: {
        runId: run.id,
        specHash: run.spec_hash,
        provider: run.provider,
        trainer: run.trainer,
      },
    },
    {
      versionId,
      kind: "licence",
      source: "provider",
      status: base.attributes.licence ? "pass" : "unknown",
      summary: `Inherits ${base.attributes.licence ?? "an unknown licence"} from its base`,
      details: { licence: base.attributes.licence, baseVersionId: base.id },
    },
    ...(run.compute
      ? [
          {
            versionId,
            kind: "compute" as const,
            source: "provider" as const,
            status: run.compute.exceedsThreshold ? ("warn" as const) : ("pass" as const),
            summary: run.compute.exceedsThreshold
              ? "Modification compute passes a third of the base's; EU AI Act provider duties likely apply"
              : `Modification compute is ${(run.compute.ratio * 100).toFixed(2)}% of the EU AI Act threshold`,
            details: { ...run.compute },
          },
        ]
      : []),
  ]);
  await preserveTrainingInputWithdrawals(repositories, run, versionId);
  await syncVersionReviews(repositories, workspaceId, versionId);

  return versionId;
}

async function recordCost(
  repositories: RepositoryManager,
  run: ModelTrainingRunRecord,
  state: TrainingJobState,
  status: TrainingRunStatus,
): Promise<number | null> {
  const usd = state.costUsd ?? (TERMINAL.has(status) ? (run.estimate.usd ?? null) : null);

  if (usd !== null) {
    await repositories.modelSpend.replaceSubjectCost({
      workspaceId: run.workspace_id,
      projectId: run.project_id,
      subjectType: "training_run",
      subjectId: run.id,
      provider: run.provider,
      usd,
      basis: state.costUsd === null ? "estimate" : "reported",
      periodStart: run.started_at ?? run.created_at,
      periodEnd: new Date().toISOString(),
    });
  }

  return usd;
}

export async function syncTrainingRun(
  env: IEnv,
  repositories: RepositoryManager,
  runId: string,
): Promise<PollOutcome> {
  let run = await repositories.modelTraining.getById(runId);

  if (!run || TERMINAL.has(run.status)) {
    return { status: "success", message: "Nothing to sync" };
  }

  const now = new Date().toISOString();

  try {
    const trainer = await trainerFor(repositories, run);

    let submitted: TrainingJobState | null = null;

    if (!run.provider_job_id) {
      if (run.status === "queued") {
        for (const versionId of new Set([
          run.spec.baseVersionId,
          ...run.spec.mergeVersionIds,
          ...run.dataset_version_ids,
        ])) {
          await requireUsableVersion(
            repositories,
            run.workspace_id,
            run.project_id,
            versionId,
            "Training input",
          );
        }
      }

      const claimed = await repositories.modelTraining.claimSubmission(run.id);

      if (!claimed) {
        assertProviderCreationPending(run.submission_started_at);

        return PENDING;
      }

      run = claimed;

      submitted = await trainer.submit(await buildSubmission(env, repositories, run));
      const updated = await repositories.modelTraining.recordProviderState(run.id, {
        status: "submitted",
        provider_job_id: submitted.providerJobId,
        started_at: submitted.startedAt ?? now,
        failure_reason: submitted.failureReason,
      });

      if (!updated) {
        await trainer.cancel(submitted.providerJobId);

        return {
          status: "error",
          message: "Run was removed during submission; the provider job was cancelled",
        };
      }

      run = updated;
    }

    if (!run.provider_job_id) {
      throw new Error("The provider did not return a job identifier");
    }

    const store = new ArtefactStore(env);

    const [state, reported] = await Promise.all([
      run.status === "cancelling"
        ? cancelProviderJob(trainer, run.provider_job_id, submitted)
        : submitted
          ? Promise.resolve(submitted)
          : trainer.status(run.provider_job_id),
      store.readJson(artefactKeys.runReport(run.workspace_id, run.id)).then(readReportedState),
    ]);

    if (run.status === "cancelling") {
      const cancelled = TERMINAL.has(state.status);
      const cost = await recordCost(
        repositories,
        run,
        state,
        cancelled ? "cancelled" : "cancelling",
      );

      await repositories.modelTraining.recordProviderState(run.id, {
        status: cancelled ? "cancelled" : "cancelling",
        cost_usd: cost,
        last_checked_at: now,
        ...(cancelled ? { completed_at: state.completedAt ?? now } : {}),
      });

      return cancelled ? { status: "success", message: "Cancelled" } : PENDING;
    }

    if (state.metrics.length > 0) {
      await store.putJson(artefactKeys.runReport(run.workspace_id, `${run.id}-provider`), {
        metrics: state.metrics,
      });
    }

    for (const checkpoint of [...state.checkpoints, ...reported.checkpoints]) {
      await repositories.modelTraining.upsertCheckpoint({
        runId: run.id,
        step: checkpoint.step,
        providerRef: checkpoint.providerRef,
        metrics: checkpoint.metrics,
      });
    }

    const status: TrainingRunStatus =
      state.status === "completed" || reported.status === "failed"
        ? (reported.status ?? state.status)
        : state.status;
    const cost = await recordCost(repositories, run, state, status);

    const latest = await repositories.modelTraining.getById(run.id);

    if (latest?.status === "cancelling") {
      return PENDING;
    }

    if (status === "completed") {
      const output: TrainingOutput | null =
        state.output ??
        (reported.revision && run.output_repository
          ? { kind: "hub", repo: run.output_repository, revision: reported.revision }
          : null);

      if (!output) {
        throw new Error("The job finished without reporting an output");
      }

      const outputVersionId = await registerOutput(repositories, env, run, output);

      const completed = await repositories.modelTraining.recordProviderState(run.id, {
        status: "completed",
        output_version_id: outputVersionId,
        completed_at: state.completedAt ?? now,
        cost_usd: cost,
        last_checked_at: now,
      });

      if (completed?.status === "cancelling") {
        return PENDING;
      }

      await repositories.audit.createRecord({
        workspaceId: run.workspace_id,
        actorUserId: null,
        action: "model_training.completed",
        targetType: "model_training_run",
        targetId: run.id,
        metadata: { outputVersionId, output, costUsd: cost },
      });

      return { status: "success", message: "Completed" };
    }

    const updated = await repositories.modelTraining.recordProviderState(run.id, {
      status,
      cost_usd: cost,
      failure_reason: state.failureReason ?? reported.error,
      last_checked_at: now,
      ...(TERMINAL.has(status) ? { completed_at: state.completedAt ?? now } : {}),
    });

    return updated && TERMINAL.has(updated.status)
      ? { status: "success", message: updated.status }
      : PENDING;
  } catch (error) {
    const reason = getErrorMessage(toAssistantError(error), "Sync failed");

    logger.warn("Training sync failed", { runId, error: reason });
    await repositories.modelTraining.recordProviderState(run.id, {
      last_checked_at: now,
      failure_reason: reason,
      ...(run.provider_job_id ? {} : { status: "failed" as const, completed_at: now }),
    });

    return run.provider_job_id ? PENDING : { status: "error", message: reason };
  }
}
