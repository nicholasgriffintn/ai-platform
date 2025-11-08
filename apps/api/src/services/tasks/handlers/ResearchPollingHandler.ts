import type { IEnv } from "~/types";
import type { TaskMessage } from "../TaskService";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import { getLogger } from "~/utils/logger";
import { DynamicAppResponseRepository } from "~/repositories/DynamicAppResponseRepository";
import type {
	ResearchProviderName,
	ResearchOptions,
	ResearchResult,
	ResearchResultError,
	ParallelTaskRun,
	ExaTaskRun,
} from "~/types";
import { safeParseJson } from "~/utils/json";
import { TaskService } from "../TaskService";
import { TaskRepository } from "~/repositories/TaskRepository";
import { getResearchProvider } from "~/lib/providers/capabilities/research";

const logger = getLogger({ prefix: "services/tasks/research-polling" });

interface ResearchPollingData {
	runId: string;
	provider: ResearchProviderName;
	userId: number;
	options?: ResearchOptions;
	startedAt: string;
}

export class ResearchPollingHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		try {
			const data = message.task_data as ResearchPollingData;

			if (!data.runId || !data.provider) {
				return {
					status: "error",
					message: "runId and provider are required for research polling",
				};
			}

			const researchProvider = getResearchProvider(data.provider, { env });

			const result = await researchProvider.fetchResearchResult(
				data.runId,
				data.options,
			);

			if ("status" in result && result.status === "error") {
				logger.warn(`Research task ${data.runId} failed: ${result.error}`);
				await this.persistError(env, data, result.error);
				return {
					status: "success",
					message: "Research task failed",
					data: { runId: data.runId, error: result.error },
				};
			}

			const researchResult = result as Exclude<
				ResearchResult,
				ResearchResultError
			>;
			const status = researchResult.run?.status?.toLowerCase() || "unknown";

			if (status === "completed") {
				logger.info(`Research task ${data.runId} completed`);
				await this.persistCompleted(env, data, researchResult);
				return {
					status: "success",
					message: "Research task completed",
					data: { runId: data.runId, output: researchResult.output },
				};
			}

			if (
				status === "failed" ||
				status === "errored" ||
				status === "cancelled"
			) {
				const error =
					(researchResult.run as any).error || "Research task failed";
				logger.warn(`Research task ${data.runId} ${status}`);
				await this.persistError(env, data, error);
				return {
					status: "success",
					message: `Research task ${status}`,
					data: { runId: data.runId, error },
				};
			}

			logger.info(`Research task ${data.runId} still ${status}, re-queuing`);
			const taskRepository = new TaskRepository(env);
			const taskService = new TaskService(env, taskRepository);

			await taskService.enqueueTask({
				task_type: "research_polling",
				user_id: message.user_id,
				task_data: data,
				schedule_type: "scheduled",
				scheduled_at: new Date(Date.now() + 5000).toISOString(),
				priority: message.priority || 5,
			});

			return {
				status: "success",
				message: "Research still in progress, re-queued",
				data: { runId: data.runId, status },
			};
		} catch (error) {
			logger.error("Research polling error:", error);
			return {
				status: "error",
				message: (error as Error).message,
			};
		}
	}

	private async persistCompleted(
		env: IEnv,
		data: ResearchPollingData,
		result: Exclude<ResearchResult, ResearchResultError>,
	): Promise<void> {
		if (!env.DB) return;

		const responseRepo = new DynamicAppResponseRepository(env);
		const response = await responseRepo.getResponseByItemId(data.runId);

		if (!response || response.user_id !== data.userId) return;

		const existingData = safeParseJson(response.data) || {};
		const updatedData = {
			...existingData,
			result: {
				status: "completed",
				data: {
					provider: result.provider,
					run: result.run,
					output: result.output,
					warnings: result.warnings,
					poll: result.poll,
				},
			},
			lastSyncedAt: new Date().toISOString(),
		};

		await responseRepo.updateResponseData(response.id, updatedData);
	}

	private async persistError(
		env: IEnv,
		data: ResearchPollingData,
		errorMessage: string,
	): Promise<void> {
		if (!env.DB) return;

		const responseRepo = new DynamicAppResponseRepository(env);
		const response = await responseRepo.getResponseByItemId(data.runId);

		if (!response || response.user_id !== data.userId) return;

		const existingData = safeParseJson(response.data) || {};
		const now = new Date().toISOString();

		const errorRun =
			data.provider === "parallel"
				? ({
						run_id: data.runId,
						status: "errored",
						is_active: false,
						processor: "unknown",
						metadata: null,
						created_at: now,
						modified_at: now,
						warnings: [errorMessage],
						error: errorMessage,
						taskgroup_id: null,
					} as ParallelTaskRun)
				: ({
						research_id: data.runId,
						status: "errored",
						created_at: now,
						error: errorMessage,
						warnings: [errorMessage],
					} as ExaTaskRun);

		const updatedData = {
			...existingData,
			result: {
				status: "error",
				error: errorMessage,
				data: {
					provider: data.provider,
					run: errorRun,
					warnings: [errorMessage],
				},
			},
			lastSyncedAt: now,
		};

		await responseRepo.updateResponseData(response.id, updatedData);
	}
}
