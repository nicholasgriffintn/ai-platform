import {
  createTrainer,
  type Trainer,
  type TrainingJobState,
} from "@ngriffin_uk/polychat-ai-model-providers";
import { ACTIVE_TRAINING_RUN_STATUSES } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { resolveProviderContext } from "~/modules/model-governance/application/connections";

import type { ModelTrainingRunRecord } from "../infrastructure/ModelTrainingRepository";

export async function trainerFor(
  repositories: RepositoryManager,
  run: Pick<ModelTrainingRunRecord, "workspace_id" | "provider" | "trainer">,
): Promise<Trainer> {
  return createTrainer(
    run.provider,
    run.trainer,
    await resolveProviderContext(repositories, run.workspace_id, run.provider),
  );
}

export async function cancelProviderJob(
  trainer: Trainer,
  jobId: string,
  submitted: TrainingJobState | null,
): Promise<TrainingJobState> {
  const state = submitted ?? (await trainer.status(jobId));

  if (!ACTIVE_TRAINING_RUN_STATUSES.includes(state.status)) {
    return state;
  }

  await trainer.cancel(jobId);

  return trainer.status(jobId);
}
