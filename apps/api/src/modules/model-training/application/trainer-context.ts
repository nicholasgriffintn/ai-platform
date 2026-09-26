import { createTrainer, type Trainer } from "@ngriffin_uk/polychat-ai-model-providers";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { resolveProviderContext } from "~/modules/model-governance/application/connections";
import { withProviderErrors } from "~/modules/model-governance/application/provider-errors";

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
  repositories: RepositoryManager,
  run: ModelTrainingRunRecord,
): Promise<void> {
  if (!run.provider_job_id) {
    return;
  }

  const trainer = await trainerFor(repositories, run);
  const jobId = run.provider_job_id;

  await withProviderErrors(() => trainer.cancel(jobId));
}
