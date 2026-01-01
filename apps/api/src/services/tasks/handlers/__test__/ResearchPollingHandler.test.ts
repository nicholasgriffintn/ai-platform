import { describe, expect, it, beforeEach, vi } from "vitest";
import type { IEnv } from "~/types";
import { ResearchPollingHandler } from "../ResearchPollingHandler";
import { getResearchProvider } from "~/lib/providers/capabilities/research";
import type { TaskMessage } from "../../TaskService";

vi.mock("~/lib/providers/capabilities/research", () => ({
	getResearchProvider: vi.fn(),
}));

let dynamicResponseRepoImpl: any;
let taskRepositoryImpl: any;
let taskServiceImpl: any;

vi.mock("~/repositories/DynamicAppResponseRepository", () => ({
	DynamicAppResponseRepository: class {
		constructor() {
			return dynamicResponseRepoImpl;
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

const mockedGetResearchProvider = vi.mocked(getResearchProvider);

describe("ResearchPollingHandler", () => {
	const baseEnv = {
		DB: {} as any,
	} as unknown as IEnv;

	const baseMessage: TaskMessage = {
		taskId: "test-task",
		task_type: "research_polling",
		user_id: 1,
		task_data: {
			runId: "test-run-id",
			provider: "parallel" as const,
			userId: 1,
			startedAt: new Date().toISOString(),
		},
		priority: 5,
	};

	let handler: ResearchPollingHandler;

	beforeEach(() => {
		vi.resetAllMocks();
		dynamicResponseRepoImpl = undefined;
		taskRepositoryImpl = undefined;
		taskServiceImpl = undefined;
		handler = new ResearchPollingHandler();
	});

	it("returns error when runId is missing", async () => {
		const message = {
			...baseMessage,
			task_data: { provider: "parallel" as const, userId: 1 },
		};

		const result = await handler.handle(message, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("runId and provider are required");
	});

	it("returns error when provider is missing", async () => {
		const message = {
			...baseMessage,
			task_data: { runId: "test-run", userId: 1 },
		};

		const result = await handler.handle(message as any, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("runId and provider are required");
	});

	it("handles error result from research provider", async () => {
		const mockFetchResult = vi.fn().mockResolvedValue({
			status: "error",
			error: "Research failed",
		});

		mockedGetResearchProvider.mockReturnValue({
			fetchResearchResult: mockFetchResult,
		} as any);

		const mockRepo = {
			getResponseByItemId: vi.fn().mockResolvedValue({
				id: "response-1",
				user_id: 1,
				data: JSON.stringify({}),
			}),
			updateResponseData: vi.fn().mockResolvedValue(undefined),
		};
		dynamicResponseRepoImpl = mockRepo;

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Research task failed");
		expect(result.data).toMatchObject({
			runId: "test-run-id",
			error: "Research failed",
		});
	});

	it("handles completed research task", async () => {
		const mockFetchResult = vi.fn().mockResolvedValue({
			provider: "parallel",
			run: {
				run_id: "test-run-id",
				status: "completed",
			},
			output: {
				content: "Research results",
			},
		});

		mockedGetResearchProvider.mockReturnValue({
			fetchResearchResult: mockFetchResult,
		} as any);

		const mockRepo = {
			getResponseByItemId: vi.fn().mockResolvedValue({
				id: "response-1",
				user_id: 1,
				data: JSON.stringify({}),
			}),
			updateResponseData: vi.fn().mockResolvedValue(undefined),
		};
		dynamicResponseRepoImpl = mockRepo;

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Research task completed");
		expect(result.data).toMatchObject({
			runId: "test-run-id",
			output: { content: "Research results" },
		});
		expect(mockRepo.updateResponseData).toHaveBeenCalled();
	});

	it("handles failed research task", async () => {
		const mockFetchResult = vi.fn().mockResolvedValue({
			provider: "parallel",
			run: {
				run_id: "test-run-id",
				status: "failed",
				error: "Task failed",
			},
		});

		mockedGetResearchProvider.mockReturnValue({
			fetchResearchResult: mockFetchResult,
		} as any);

		const mockRepo = {
			getResponseByItemId: vi.fn().mockResolvedValue({
				id: "response-1",
				user_id: 1,
				data: JSON.stringify({}),
			}),
			updateResponseData: vi.fn().mockResolvedValue(undefined),
		};
		dynamicResponseRepoImpl = mockRepo;

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Research task failed");
	});

	it("re-queues task when research is still in progress", async () => {
		const mockFetchResult = vi.fn().mockResolvedValue({
			provider: "parallel",
			run: {
				run_id: "test-run-id",
				status: "running",
			},
		});

		mockedGetResearchProvider.mockReturnValue({
			fetchResearchResult: mockFetchResult,
		} as any);

		const mockEnqueueTask = vi.fn().mockResolvedValue(undefined);
		taskServiceImpl = {
			enqueueTask: mockEnqueueTask,
		};

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toContain("re-queued");
		expect(mockEnqueueTask).toHaveBeenCalledWith(
			expect.objectContaining({
				task_type: "research_polling",
				task_data: baseMessage.task_data,
			}),
		);
	});

	it("skips persistence when response does not belong to user", async () => {
		const mockFetchResult = vi.fn().mockResolvedValue({
			provider: "parallel",
			run: {
				run_id: "test-run-id",
				status: "completed",
			},
			output: { content: "Results" },
		});

		mockedGetResearchProvider.mockReturnValue({
			fetchResearchResult: mockFetchResult,
		} as any);

		const mockRepo = {
			getResponseByItemId: vi.fn().mockResolvedValue({
				id: "response-1",
				user_id: 999,
				data: JSON.stringify({}),
			}),
			updateResponseData: vi.fn().mockResolvedValue(undefined),
		};
		dynamicResponseRepoImpl = mockRepo;

		await handler.handle(baseMessage, baseEnv);

		expect(mockRepo.updateResponseData).not.toHaveBeenCalled();
	});
});
