import { deriveArtificialAnalysisScores } from "~/lib/artificial-analysis/scoring";
import type { ArtificialAnalysisModelRecord } from "~/lib/artificial-analysis/types";
import { detectModelPriceDrift } from "~/lib/pricing/modelPriceDrift";
import { getModels } from "~/lib/providers/models";
import { RepositoryManager } from "~/repositories";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import { fetchArtificialAnalysisModels } from "./artificialAnalysis";

const logger = getLogger({ prefix: "services/model-analysis/workflow" });

function reportModelPriceDrift(references: readonly ArtificialAnalysisModelRecord[]): number {
  const report = detectModelPriceDrift(getModels(), references);

  if (report.drifted.length === 0) {
    logger.info("Model catalogue prices agree with Artificial Analysis", {
      compared: report.compared,
      matched: report.matched,
    });

    return 0;
  }

  logger.warn("Model catalogue prices diverge from Artificial Analysis", {
    compared: report.compared,
    matched: report.matched,
    drifted: report.drifted,
  });

  return report.drifted.length;
}

export async function ingestArtificialAnalysisModels({
  env,
  fetchImpl = fetch,
  now = new Date(),
  sourceTaskId,
}: {
  env: IEnv;
  fetchImpl?: typeof fetch;
  now?: Date;
  sourceTaskId: string;
}): Promise<{ storedModels: number; scoringTaskId: string; driftedModelPrices: number }> {
  if (!env.ARTIFICIAL_ANALYSIS_API_KEY) {
    throw new Error("ARTIFICIAL_ANALYSIS_API_KEY is not configured");
  }

  const ingestedAt = now.toISOString();
  const repositories = RepositoryManager.getInstance(env);
  const taskService = new TaskService(env, repositories.tasks);
  const models = await fetchArtificialAnalysisModels(env.ARTIFICIAL_ANALYSIS_API_KEY, fetchImpl);
  const records = models.map((model) => ({
    ...model,
    ingested_at: ingestedAt,
  }));
  const storedModels = await repositories.artificialAnalysis.upsertMany(records);
  const driftedModelPrices = reportModelPriceDrift(records);
  const scheduledAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const scoringTaskId = await taskService.enqueueTask({
    id: `artificial-analysis-scoring:${sourceTaskId}`,
    task_type: "artificial_analysis_scoring",
    task_data: {
      sourceTaskId,
      ingestedAt,
    },
    schedule_type: "scheduled",
    scheduled_at: scheduledAt,
    priority: 6,
  });

  return { storedModels, scoringTaskId, driftedModelPrices };
}

export async function scoreArtificialAnalysisModels({
  env,
}: {
  env: IEnv;
}): Promise<{ scoredModels: number }> {
  const repository = RepositoryManager.getInstance(env).artificialAnalysis;
  const models = await repository.listAll();

  for (const model of models) {
    await repository.updateDerivedScores(model.id, deriveArtificialAnalysisScores(model));
  }

  return { scoredModels: models.length };
}
