import {
  MODEL_DATASET_PROCESS_TASK_TYPE,
  MODEL_DEPLOYMENT_SYNC_TASK_TYPE,
  MODEL_PLATFORM_RECONCILE_TASK_TYPE,
  MODEL_TRAINING_SYNC_TASK_TYPE,
  MODEL_UPLOAD_FINALISE_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { createRepositories } from "~/infrastructure/database/repositories";
import {
  runModelGovernanceMaintenance,
  scheduleModelPlatformReconciles,
} from "~/modules/model-governance/application/maintenance";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import {
  modelDatasetProcessing,
  modelDeploymentSync,
  modelPlatformReconcile,
  modelTrainingSync,
  modelUploadFinalise,
} from "./model-platform";

export function registerModelPlatformQueue(workflows: AppWorkflows): void {
  workflows.on(MODEL_PLATFORM_RECONCILE_TASK_TYPE, modelPlatformReconcile);
  workflows.poll(MODEL_DATASET_PROCESS_TASK_TYPE, modelDatasetProcessing);
  workflows.poll(MODEL_TRAINING_SYNC_TASK_TYPE, modelTrainingSync);
  workflows.poll(MODEL_DEPLOYMENT_SYNC_TASK_TYPE, modelDeploymentSync);
  workflows.poll(MODEL_UPLOAD_FINALISE_TASK_TYPE, modelUploadFinalise);

  workflows.every(
    SCHEDULES.MODEL_PLATFORM_RECONCILE,
    defineSchedule({
      name: "model-platform-reconcile",
      run: async ({ env }) => {
        await scheduleModelPlatformReconciles(env, createRepositories(env));
      },
    }),
  );

  workflows.every(
    SCHEDULES.MODEL_GOVERNANCE,
    defineSchedule({
      name: "model-governance",
      run: async ({ env }) => {
        await runModelGovernanceMaintenance(env, createRepositories(env));
      },
    }),
  );
}
