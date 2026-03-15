import type { IEnv } from "~/types";
import type { TaskMessage } from "../TaskService";
import type { TaskHandler, TaskResult } from "../TaskHandler";
import { getLogger } from "~/utils/logger";
import { AppDataRepository } from "~/repositories/AppDataRepository";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import { safeParseJson } from "~/utils/json";
import { TaskService } from "../TaskService";
import { TaskRepository } from "~/repositories/TaskRepository";
import { getNextPollingSchedule } from "./polling";

const logger = getLogger({
	prefix: "services/tasks/podcast-transcription-polling",
});

interface PodcastTranscriptionPollingData {
	podcastId: string;
	userId: number;
	startedAt: string;
	pollAttempt?: number;
}

export class PodcastTranscriptionPollingHandler implements TaskHandler {
	public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
		try {
			const data = message.task_data as PodcastTranscriptionPollingData;

			if (!data.podcastId || !data.userId) {
				return {
					status: "error",
					message: "podcastId and userId are required for podcast polling",
				};
			}

			const appDataRepo = new AppDataRepository(env);
			const records = await appDataRepo.getAppDataByUserAppAndItem(
				data.userId,
				"podcasts",
				data.podcastId,
				"transcribe",
			);
			const transcriptionRecord = records[0];

			if (!transcriptionRecord) {
				return {
					status: "error",
					message: `Podcast transcription ${data.podcastId} not found`,
				};
			}

			const transcriptionData = safeParseJson(transcriptionRecord.data);
			if (!transcriptionData) {
				return {
					status: "error",
					message: "Invalid podcast transcription data",
				};
			}

			const asyncInvocation = transcriptionData.transcriptionData?.data
				?.asyncInvocation as AsyncInvocationMetadata | undefined;
			if (!asyncInvocation || transcriptionData.status !== "pending") {
				return {
					status: "success",
					message: "Podcast transcription is not pending",
					data: {
						podcastId: data.podcastId,
						status: transcriptionData.status,
					},
				};
			}

			const provider = getChatProvider(
				asyncInvocation.provider || "replicate",
				{
					env,
					user: undefined,
				},
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
					completion_id: data.podcastId,
				},
				data.userId,
			);

			if (result.status === "completed" && result.result) {
				transcriptionData.status = "complete";
				transcriptionData.transcriptionData = result.result;
				transcriptionData.output = result.result.response;
				await appDataRepo.updateAppData(
					transcriptionRecord.id,
					transcriptionData,
				);
				return {
					status: "success",
					message: "Podcast transcription completed",
					data: { podcastId: data.podcastId },
				};
			}

			if (result.status === "failed") {
				transcriptionData.status = "failed";
				transcriptionData.error = result.raw?.error || "Transcription failed";
				await appDataRepo.updateAppData(
					transcriptionRecord.id,
					transcriptionData,
				);
				return {
					status: "success",
					message: "Podcast transcription failed",
					data: {
						podcastId: data.podcastId,
						error: transcriptionData.error,
					},
				};
			}

			const polling = getNextPollingSchedule(data.pollAttempt);
			const taskRepository = new TaskRepository(env);
			const taskService = new TaskService(env, taskRepository);
			await taskService.enqueueTask({
				task_type: "podcast_transcription_polling",
				user_id: message.user_id,
				task_data: {
					...data,
					pollAttempt: polling.pollAttempt,
				},
				schedule_type: "scheduled",
				scheduled_at: polling.scheduledAt,
				priority: message.priority || 5,
			});

			return {
				status: "success",
				message: "Podcast transcription still in progress, re-queued",
				data: { podcastId: data.podcastId },
			};
		} catch (error) {
			logger.error("Podcast transcription polling error:", error);
			return {
				status: "error",
				message: (error as Error).message,
			};
		}
	}
}
