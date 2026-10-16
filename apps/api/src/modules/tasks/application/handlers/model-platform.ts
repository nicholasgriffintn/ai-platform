import {
  modelDatasetProcessTaskDataSchema,
  modelDeploymentSyncTaskDataSchema,
  modelPlatformReconcileTaskDataSchema,
  modelTrainingSyncTaskDataSchema,
  modelUploadFinaliseTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";

import { createRepositories } from "~/infrastructure/database/repositories";
import { processDataset } from "~/modules/model-datasets/application/pipeline";
import { reconcileModelPlatform } from "~/modules/model-governance/application/maintenance";
import { finaliseUpload } from "~/modules/model-registry/application/uploads";
import { syncDeployment } from "~/modules/model-serving/application/sync";
import { syncTrainingRun } from "~/modules/model-training/application/sync";

import { definePoll, defineTask } from "../workflows";

export const modelDatasetProcessing = definePoll({
  payload: modelDatasetProcessTaskDataSchema,
  delaysSeconds: [1, 2, 5],
  maxAttempts: 2000,
  check: ({ versionId }, { env }) => processDataset(env, createRepositories(env), versionId),
});

export const modelTrainingSync = definePoll({
  payload: modelTrainingSyncTaskDataSchema,
  delaysSeconds: [30, 60, 120, 300],
  maxAttempts: 1200,
  check: ({ runId }, { env }) => syncTrainingRun(env, createRepositories(env), runId),
});

export const modelDeploymentSync = definePoll({
  payload: modelDeploymentSyncTaskDataSchema,
  delaysSeconds: [15, 30, 60, 120],
  maxAttempts: 240,
  check: ({ deploymentId }, { env }) => syncDeployment(createRepositories(env), deploymentId),
});

export const modelUploadFinalise = definePoll({
  payload: modelUploadFinaliseTaskDataSchema,
  delaysSeconds: [5, 10, 30, 60],
  maxAttempts: 600,
  check: (data, { env }) => finaliseUpload(env, createRepositories(env), data),
});

export const modelPlatformReconcile = defineTask({
  payload: modelPlatformReconcileTaskDataSchema,
  handle: async ({ workspaceId }, { env }) => {
    const result = await reconcileModelPlatform(env, createRepositories(env), workspaceId);

    return {
      status: "success",
      message: `Paused ${result.paused}, resynced ${result.resynced}`,
      data: result,
    };
  },
});
