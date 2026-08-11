import { describe, expect, it, beforeEach, vi } from "vitest";
import type { IEnv } from "~/types";
import { ReplicatePollingHandler } from "../ReplicatePollingHandler";
import * as chatCapability from "~/lib/providers/capabilities/chat";
import type { TaskMessage } from "../../TaskService";

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(),
}));

let outputRepoImpl: any;
let taskRepositoryImpl: any;
let taskServiceImpl: any;

vi.mock("~/repositories/OutputRepository", () => ({
	OutputRepository: class {
		constructor() {
			return outputRepoImpl;
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
		outputRepoImpl = undefined;
		taskRepositoryImpl = undefined;
		taskServiceImpl = undefined;
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
			getOutput: vi.fn().mockResolvedValue(null),
		};
		outputRepoImpl = mockRepo;

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("not found");
	});

	it("returns error when user is unauthorized", async () => {
		const mockRepo = {
			getOutput: vi.fn().mockResolvedValue({
				id: "pred-123",
				created_by_user_id: 999,
				content: JSON.stringify({}),
			}),
		};
		outputRepoImpl = mockRepo;

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("Unauthorized");
	});

	it("handles completed prediction", async () => {
		const mockRepo = {
			getOutput: vi.fn().mockResolvedValue({
				id: "pred-123",
				created_by_user_id: 1,
				revision: 1,
				content: JSON.stringify({
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
			updateOutput: vi.fn().mockResolvedValue(undefined),
		};
		outputRepoImpl = mockRepo;

		const mockProvider = {
			getAsyncInvocationStatus: vi.fn().mockResolvedValue({
				status: "completed",
				result: {
					response: "Generated output",
				},
			}),
		};
		vi.mocked(chatCapability.getChatProvider).mockReturnValue(mockProvider as any);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Prediction completed");
		expect(result.data).toMatchObject({
			predictionId: "pred-123",
			output: "Generated output",
		});
		expect(mockRepo.updateOutput).toHaveBeenCalledWith(
			"pred-123",
			expect.objectContaining({
				status: "ready",
				content: expect.objectContaining({ status: "succeeded" }),
			}),
		);
	});

	it("handles failed prediction", async () => {
		const mockRepo = {
			getOutput: vi.fn().mockResolvedValue({
				id: "pred-123",
				created_by_user_id: 1,
				revision: 1,
				content: JSON.stringify({
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
			updateOutput: vi.fn().mockResolvedValue(undefined),
		};
		outputRepoImpl = mockRepo;

		const mockProvider = {
			getAsyncInvocationStatus: vi.fn().mockResolvedValue({
				status: "failed",
				raw: {
					error: "Generation failed",
				},
			}),
		};
		vi.mocked(chatCapability.getChatProvider).mockReturnValue(mockProvider as any);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Prediction failed");
		expect(mockRepo.updateOutput).toHaveBeenCalledWith(
			"pred-123",
			expect.objectContaining({
				status: "failed",
				content: expect.objectContaining({
					status: "failed",
					error: "Generation failed",
				}),
			}),
		);
	});

	it("re-queues task when prediction is still in progress", async () => {
		const mockRepo = {
			getOutput: vi.fn().mockResolvedValue({
				id: "pred-123",
				created_by_user_id: 1,
				revision: 1,
				content: JSON.stringify({
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
		outputRepoImpl = mockRepo;

		const mockProvider = {
			getAsyncInvocationStatus: vi.fn().mockResolvedValue({
				status: "in_progress",
			}),
		};
		vi.mocked(chatCapability.getChatProvider).mockReturnValue(mockProvider as any);

		const mockEnqueueTask = vi.fn().mockResolvedValue(undefined);
		taskServiceImpl = {
			enqueueTask: mockEnqueueTask,
		};

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
			getOutput: vi.fn().mockResolvedValue({
				id: "pred-123",
				created_by_user_id: 1,
				content: JSON.stringify({
					status: "succeeded",
				}),
			}),
		};
		outputRepoImpl = mockRepo;

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toContain("not in processing state");
	});

	it("returns error when provider does not support async status", async () => {
		const mockRepo = {
			getOutput: vi.fn().mockResolvedValue({
				id: "pred-123",
				created_by_user_id: 1,
				content: JSON.stringify({
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
		outputRepoImpl = mockRepo;

		const mockProvider = {};
		vi.mocked(chatCapability.getChatProvider).mockReturnValue(mockProvider as any);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("does not support async invocation status");
	});
});
