import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskMessage } from "../../TaskService";
import type { IEnv } from "~/types";
import { PodcastTranscriptionPollingHandler } from "../PodcastTranscriptionPollingHandler";
import * as chatCapability from "~/lib/providers/capabilities/chat";

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(),
}));

let appDataRepoImpl: any;
let taskRepositoryImpl: any;
let taskServiceImpl: any;

vi.mock("~/repositories/AppDataRepository", () => ({
	AppDataRepository: class {
		constructor() {
			return appDataRepoImpl;
		}
	},
}));

vi.mock("~/repositories/TaskRepository", () => ({
	TaskRepository: class {
		constructor() {
			return taskRepositoryImpl ?? {};
		}
	},
}));

vi.mock("../../TaskService", () => ({
	TaskService: class {
		constructor() {
			return taskServiceImpl ?? {};
		}
	},
}));

describe("PodcastTranscriptionPollingHandler", () => {
	const baseEnv = {
		DB: {} as any,
	} as unknown as IEnv;

	const baseMessage: TaskMessage = {
		taskId: "task-1",
		task_type: "podcast_transcription_polling",
		user_id: 7,
		task_data: {
			podcastId: "podcast-1",
			userId: 7,
			startedAt: new Date().toISOString(),
			pollAttempt: 0,
		},
		priority: 6,
	};

	let handler: PodcastTranscriptionPollingHandler;

	beforeEach(() => {
		vi.resetAllMocks();
		appDataRepoImpl = undefined;
		taskRepositoryImpl = undefined;
		taskServiceImpl = undefined;
		handler = new PodcastTranscriptionPollingHandler();
	});

	it("returns error when required fields are missing", async () => {
		const result = await handler.handle(
			{
				...baseMessage,
				task_data: { userId: 7 },
			} as any,
			baseEnv,
		);

		expect(result.status).toBe("error");
		expect(result.message).toContain("podcastId and userId are required");
	});

	it("completes transcription when provider result is completed", async () => {
		const mockRepo = {
			getAppDataByUserAppAndItem: vi.fn().mockResolvedValue([
				{
					id: "record-1",
					data: JSON.stringify({
						status: "pending",
						transcriptionData: {
							data: {
								asyncInvocation: {
									provider: "replicate",
									id: "async-1",
								},
							},
						},
					}),
				},
			]),
			updateAppData: vi.fn().mockResolvedValue(undefined),
		};
		appDataRepoImpl = mockRepo;

		vi.mocked(chatCapability.getChatProvider).mockReturnValue({
			getAsyncInvocationStatus: vi.fn().mockResolvedValue({
				status: "completed",
				result: { response: "Transcript" },
			}),
		} as any);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Podcast transcription completed");
		expect(mockRepo.updateAppData).toHaveBeenCalledWith(
			"record-1",
			expect.objectContaining({
				status: "complete",
			}),
		);
	});

	it("re-queues transcription when still in progress", async () => {
		const mockRepo = {
			getAppDataByUserAppAndItem: vi.fn().mockResolvedValue([
				{
					id: "record-1",
					data: JSON.stringify({
						status: "pending",
						transcriptionData: {
							data: {
								asyncInvocation: {
									provider: "replicate",
									id: "async-1",
								},
							},
						},
					}),
				},
			]),
		};
		appDataRepoImpl = mockRepo;

		vi.mocked(chatCapability.getChatProvider).mockReturnValue({
			getAsyncInvocationStatus: vi.fn().mockResolvedValue({
				status: "in_progress",
			}),
		} as any);

		const mockEnqueueTask = vi.fn().mockResolvedValue(undefined);
		taskServiceImpl = { enqueueTask: mockEnqueueTask };

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toContain("re-queued");
		expect(mockEnqueueTask).toHaveBeenCalledWith(
			expect.objectContaining({
				task_type: "podcast_transcription_polling",
			}),
		);
	});
});
