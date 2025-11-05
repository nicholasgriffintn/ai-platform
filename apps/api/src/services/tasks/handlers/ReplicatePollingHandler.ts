import type { IEnv } from "~/types";
import type { TaskMessage } from "../TaskService";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import { getLogger } from "~/utils/logger";
import { AIProviderFactory } from "~/lib/providers/factory";
import { AppDataRepository } from "~/repositories/AppDataRepository";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import { safeParseJson } from "~/utils/json";
import { TaskService } from "../TaskService";
import { TaskRepository } from "~/repositories/TaskRepository";

const logger = getLogger({ prefix: "services/tasks/replicate-polling" });

interface ReplicatePollingData {
	predictionId: string;
	userId: number;
	modelId: string;
	startedAt: string;
}

export class ReplicatePollingHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		try {
			const data = message.task_data as ReplicatePollingData;

			if (!data.predictionId || !data.userId) {
				return {
					status: "error",
					message: "predictionId and userId are required for replicate polling",
				};
			}

			const appDataRepo = new AppDataRepository(env);
			const prediction = await appDataRepo.getAppDataById(data.predictionId);

			if (!prediction) {
				return {
					status: "error",
					message: `Prediction ${data.predictionId} not found`,
				};
			}

			if (prediction.user_id !== data.userId) {
				return {
					status: "error",
					message: "Unauthorized access to prediction",
				};
			}

			const predictionData = safeParseJson(prediction.data);

			if (!predictionData) {
				return {
					status: "error",
					message: "Invalid prediction data",
				};
			}

			const asyncInvocation = predictionData.predictionData?.data
				?.asyncInvocation as AsyncInvocationMetadata | undefined;

			if (!asyncInvocation || predictionData.status !== "processing") {
				logger.info(`Prediction ${data.predictionId} not in processing state`);
				return {
					status: "success",
					message: "Prediction not in processing state",
					data: { predictionId: data.predictionId, status: predictionData.status },
				};
			}

			const provider = AIProviderFactory.getProvider(
				asyncInvocation.provider || "replicate",
			);

			if (!provider?.getAsyncInvocationStatus) {
				return {
					status: "error",
					message: "Provider does not support async invocation status",
				};
			}

			const result = await provider.getAsyncInvocationStatus(
				asyncInvocation,
				{
					model: asyncInvocation.context?.version || "",
					env,
					messages: [],
					completion_id: data.predictionId,
				},
				data.userId,
			);

			if (result.status === "completed" && result.result) {
				logger.info(`Prediction ${data.predictionId} completed`);

				predictionData.status = "succeeded";
				predictionData.predictionData = result.result;
				predictionData.output = result.result.response;

				await appDataRepo.updateAppData(data.predictionId, predictionData);

				return {
					status: "success",
					message: "Prediction completed",
					data: {
						predictionId: data.predictionId,
						output: result.result.response,
					},
				};
			}

			if (result.status === "failed") {
				logger.warn(`Prediction ${data.predictionId} failed`);

				predictionData.status = "failed";
				predictionData.error = result.raw?.error || "Generation failed";

				await appDataRepo.updateAppData(data.predictionId, predictionData);

				return {
					status: "success",
					message: "Prediction failed",
					data: {
						predictionId: data.predictionId,
						error: predictionData.error,
					},
				};
			}

			logger.info(`Prediction ${data.predictionId} still in progress, re-queuing`);

			const taskRepository = new TaskRepository(env);
			const taskService = new TaskService(env, taskRepository);

			await taskService.enqueueTask({
				task_type: "replicate_polling",
				user_id: message.user_id,
				task_data: data,
				schedule_type: "scheduled",
				scheduled_at: new Date(Date.now() + 5000).toISOString(),
				priority: message.priority || 5,
			});

			return {
				status: "success",
				message: "Prediction still in progress, re-queued",
				data: { predictionId: data.predictionId },
			};
		} catch (error) {
			logger.error("Replicate polling error:", error);
			return {
				status: "error",
				message: (error as Error).message,
			};
		}
	}
}
