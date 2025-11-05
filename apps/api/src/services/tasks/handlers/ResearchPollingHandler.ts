import type { IEnv } from "~/types";
import type { TaskMessage } from "../TaskService";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import { getLogger } from "~/utils/logger";
import { Research } from "~/lib/research";
import { DynamicAppResponseRepository } from "~/repositories/DynamicAppResponseRepository";
import type {
	ResearchProviderName,
	ResearchOptions,
	ResearchResult,
	ParallelTaskRun,
	ExaTaskRun,
} from "~/types";
import { safeParseJson } from "~/utils/json";
import { TaskService } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/research-polling" });

interface ResearchPollingData {
	runId: string;
	provider: ResearchProviderName;
	userId: number;
	options?: ResearchOptions;
	startedAt: string;
	responseId?: string;
	pollCount?: number;
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

			const research = Research.getInstance(env, data.provider, {
				id: data.userId,
			});

			const result = await research.fetchResult(data.runId, data.options);

			if ("status" in result && result.status === "error") {
				logger.warn(`Research task ${data.runId} failed: ${result.error}`);

				if (data.responseId && env.DB) {
					await this.persistErrorResult(
						env,
						data.responseId,
						data.runId,
						data.provider,
						result.error,
					);
				}

				return {
					status: "success",
					message: "Research task failed, error persisted",
					data: { runId: data.runId, error: result.error },
				};
			}

			const researchResult = result as ResearchResult;
			const status = researchResult.run?.status?.toLowerCase() || "unknown";

			if (status === "completed") {
				logger.info(`Research task ${data.runId} completed successfully`);

				if (data.responseId && env.DB) {
					await this.persistCompletedResult(
						env,
						data.responseId,
						researchResult,
					);
				}

				return {
					status: "success",
					message: "Research task completed",
					data: {
						runId: data.runId,
						output: researchResult.output,
					},
				};
			}

			if (status === "failed" || status === "errored" || status === "cancelled") {
				const errorMessage =
					(researchResult.run as any).error || "Research task failed";
				logger.warn(`Research task ${data.runId} ${status}: ${errorMessage}`);

				if (data.responseId && env.DB) {
					await this.persistErrorResult(
						env,
						data.responseId,
						data.runId,
						data.provider,
						errorMessage,
					);
				}

				return {
					status: "success",
					message: `Research task ${status}`,
					data: { runId: data.runId, error: errorMessage },
				};
			}

			const pollCount = (data.pollCount || 0) + 1;
			const maxPolls = 120; // 10 minutes at 5-second intervals

			if (pollCount >= maxPolls) {
				logger.warn(`Research task ${data.runId} exceeded max poll attempts`);

				if (data.responseId && env.DB) {
					await this.persistErrorResult(
						env,
						data.responseId,
						data.runId,
						data.provider,
						"Polling timeout exceeded",
					);
				}

				return {
					status: "error",
					message: "Research polling timeout exceeded",
				};
			}

			logger.info(
				`Research task ${data.runId} still ${status}, re-queuing (attempt ${pollCount}/${maxPolls})`,
			);

			const taskService = new TaskService(
				env,
				// @ts-ignore - we'll fix this after implementing the repository access
				null,
			);

			await taskService.enqueueTask({
				task_type: "research_polling",
				task_data: {
					...data,
					pollCount,
				},
				schedule_type: "scheduled",
				scheduled_at: new Date(Date.now() + 5000).toISOString(),
				priority: message.priority || 5,
			});

			return {
				status: "success",
				message: `Research still in progress, re-queued for polling (attempt ${pollCount})`,
				data: { runId: data.runId, status, pollCount },
			};
		} catch (error) {
			logger.error("Research polling error:", error);
			return {
				status: "error",
				message: (error as Error).message,
			};
		}
	}

	private async persistCompletedResult(
		env: IEnv,
		responseId: string,
		result: ResearchResult,
	): Promise<void> {
		const responseRepo = new DynamicAppResponseRepository(env);
		const existingResponse = await responseRepo.getResponseById(responseId);

		if (!existingResponse) {
			logger.warn(`Response ${responseId} not found for persistence`);
			return;
		}

		const existingData = safeParseJson(existingResponse.data) || {};
		const existingResult = existingData.result || {};

		const updatedData = {
			...existingData,
			result: {
				...existingResult,
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

		await responseRepo.updateResponseData(responseId, updatedData);
		logger.info(`Research result persisted for response ${responseId}`);
	}

	private async persistErrorResult(
		env: IEnv,
		responseId: string,
		runId: string,
		provider: ResearchProviderName,
		errorMessage: string,
	): Promise<void> {
		const responseRepo = new DynamicAppResponseRepository(env);
		const existingResponse = await responseRepo.getResponseById(responseId);

		if (!existingResponse) {
			logger.warn(`Response ${responseId} not found for error persistence`);
			return;
		}

		const existingData = safeParseJson(existingResponse.data) || {};
		const now = new Date().toISOString();

		const errorRun =
			provider === "parallel"
				? ({
						run_id: runId,
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
						research_id: runId,
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
					provider,
					run: errorRun,
					warnings: [errorMessage],
				},
			},
			lastSyncedAt: now,
		};

		await responseRepo.updateResponseData(responseId, updatedData);
		logger.info(`Research error persisted for response ${responseId}`);
	}
}
