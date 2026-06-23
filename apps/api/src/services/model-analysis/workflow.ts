import { RepositoryManager } from "~/repositories";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv } from "~/types";
import {
	deriveArtificialAnalysisScores,
	fetchArtificialAnalysisModels,
} from "./artificialAnalysis";

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
}): Promise<{ storedModels: number; scoringTaskId: string }> {
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

	return { storedModels, scoringTaskId };
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
