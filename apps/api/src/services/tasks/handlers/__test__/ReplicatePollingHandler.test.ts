import { describe, expect, it, beforeEach, vi } from "vitest";
import type { IEnv } from "~/types";
import { ReplicatePollingHandler } from "../ReplicatePollingHandler";
import * as chatCapability from "~/lib/providers/capabilities/chat";
import { AppDataRepository } from "~/repositories/AppDataRepository";
import { TaskService } from "../../TaskService";
import type { TaskMessage } from "../../TaskService";

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(),
}));

vi.mock("~/repositories/AppDataRepository");
vi.mock("~/repositories/TaskRepository");
vi.mock("../../TaskService");
const mockedAppDataRepository = vi.mocked(AppDataRepository);
const mockedTaskService = vi.mocked(TaskService);

describe("ReplicatePollingHandler", () => {
	const baseEnv = {
		DB: {} as any,
	} as unknown as IEnv;

	const baseMessage: TaskMessage = {
		taskId: "test-task",
		task_type: "replicate_polling",
		user_id: 1,
		task_data: {
			predictionId: "pred-123",
			userId: 1,
			modelId: "test-model",
			startedAt: new Date().toISOString(),
		},
		priority: 6,
	};

	let handler: ReplicatePollingHandler;

	beforeEach(() => {
		vi.resetAllMocks();
		handler = new ReplicatePollingHandler();
	});

	it("returns error when predictionId is missing", async () => {
		const message = {
			...baseMessage,
			task_data: { userId: 1, modelId: "test-model" },
		};

		const result = await handler.handle(message as any, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("predictionId and userId are required");
	});

	it("returns error when prediction not found", async () => {
		const mockRepo = {
			getAppDataById: vi.fn().mockResolvedValue(null),
		};
		mockedAppDataRepository.mockImplementation(() => mockRepo as any);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("not found");
	});

	it("returns error when user is unauthorized", async () => {
		const mockRepo = {
			getAppDataById: vi.fn().mockResolvedValue({
				id: "pred-123",
				user_id: 999,
				data: JSON.stringify({}),
			}),
		};
		mockedAppDataRepository.mockImplementation(() => mockRepo as any);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("Unauthorized");
	});

	it("handles completed prediction", async () => {
		const mockRepo = {
			getAppDataById: vi.fn().mockResolvedValue({
				id: "pred-123",
				user_id: 1,
				data: JSON.stringify({
					status: "processing",
					predictionData: {
						data: {
							asyncInvocation: {
								provider: "replicate",
								id: "pred-123",
							},
						},
					},
				}),
			}),
			updateAppData: vi.fn().mockResolvedValue(undefined),
		};
		mockedAppDataRepository.mockImplementation(() => mockRepo as any);

		const mockProvider = {
			getAsyncInvocationStatus: vi.fn().mockResolvedValue({
				status: "completed",
				result: {
					response: "Generated output",
				},
			}),
		};
		vi.mocked(chatCapability.getChatProvider).mockReturnValue(
			mockProvider as any,
		);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Prediction completed");
		expect(result.data).toMatchObject({
			predictionId: "pred-123",
			output: "Generated output",
		});
		expect(mockRepo.updateAppData).toHaveBeenCalledWith(
			"pred-123",
			expect.objectContaining({
				status: "succeeded",
			}),
		);
	});

	it("handles failed prediction", async () => {
		const mockRepo = {
			getAppDataById: vi.fn().mockResolvedValue({
				id: "pred-123",
				user_id: 1,
				data: JSON.stringify({
					status: "processing",
					predictionData: {
						data: {
							asyncInvocation: {
								provider: "replicate",
								id: "pred-123",
							},
						},
					},
				}),
			}),
			updateAppData: vi.fn().mockResolvedValue(undefined),
		};
		mockedAppDataRepository.mockImplementation(() => mockRepo as any);

		const mockProvider = {
			getAsyncInvocationStatus: vi.fn().mockResolvedValue({
				status: "failed",
				raw: {
					error: "Generation failed",
				},
			}),
		};
		vi.mocked(chatCapability.getChatProvider).mockReturnValue(
			mockProvider as any,
		);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Prediction failed");
		expect(mockRepo.updateAppData).toHaveBeenCalledWith(
			"pred-123",
			expect.objectContaining({
				status: "failed",
				error: "Generation failed",
			}),
		);
	});

	it("re-queues task when prediction is still in progress", async () => {
		const mockRepo = {
			getAppDataById: vi.fn().mockResolvedValue({
				id: "pred-123",
				user_id: 1,
				data: JSON.stringify({
					status: "processing",
					predictionData: {
						data: {
							asyncInvocation: {
								provider: "replicate",
								id: "pred-123",
							},
						},
					},
				}),
			}),
		};
		mockedAppDataRepository.mockImplementation(() => mockRepo as any);

		const mockProvider = {
			getAsyncInvocationStatus: vi.fn().mockResolvedValue({
				status: "in_progress",
			}),
		};
		vi.mocked(chatCapability.getChatProvider).mockReturnValue(
			mockProvider as any,
		);

		const mockEnqueueTask = vi.fn().mockResolvedValue(undefined);
		mockedTaskService.mockImplementation(
			() =>
				({
					enqueueTask: mockEnqueueTask,
				}) as any,
		);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toContain("re-queued");
		expect(mockEnqueueTask).toHaveBeenCalledWith(
			expect.objectContaining({
				task_type: "replicate_polling",
			}),
		);
	});

	it("skips processing when prediction not in processing state", async () => {
		const mockRepo = {
			getAppDataById: vi.fn().mockResolvedValue({
				id: "pred-123",
				user_id: 1,
				data: JSON.stringify({
					status: "succeeded",
				}),
			}),
		};
		mockedAppDataRepository.mockImplementation(() => mockRepo as any);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toContain("not in processing state");
	});

	it("returns error when provider does not support async status", async () => {
		const mockRepo = {
			getAppDataById: vi.fn().mockResolvedValue({
				id: "pred-123",
				user_id: 1,
				data: JSON.stringify({
					status: "processing",
					predictionData: {
						data: {
							asyncInvocation: {
								provider: "replicate",
								id: "pred-123",
							},
						},
					},
				}),
			}),
		};
		mockedAppDataRepository.mockImplementation(() => mockRepo as any);

		const mockProvider = {};
		vi.mocked(chatCapability.getChatProvider).mockReturnValue(
			mockProvider as any,
		);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain(
			"does not support async invocation status",
		);
	});
});
