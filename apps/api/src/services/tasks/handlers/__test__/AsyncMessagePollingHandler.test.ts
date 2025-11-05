import { describe, expect, it, beforeEach, vi } from "vitest";
import type { IEnv } from "~/types";
import { AsyncMessagePollingHandler } from "../AsyncMessagePollingHandler";
import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { handleAsyncInvocation } from "~/services/completions/async/handler";
import { isAsyncInvocationPending } from "~/lib/async/asyncInvocation";
import { TaskService } from "../../TaskService";
import type { TaskMessage } from "../../TaskService";

vi.mock("~/lib/database", () => ({
	Database: {
		getInstance: vi.fn(),
	},
}));

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: vi.fn(),
	},
}));

vi.mock("~/services/completions/async/handler");
vi.mock("~/lib/async/asyncInvocation");
vi.mock("~/repositories/TaskRepository");
vi.mock("../../TaskService");

const mockedDatabase = vi.mocked(Database);
const mockedConversationManager = vi.mocked(ConversationManager);
const mockedHandleAsyncInvocation = vi.mocked(handleAsyncInvocation);
const mockedIsAsyncInvocationPending = vi.mocked(isAsyncInvocationPending);
const mockedTaskService = vi.mocked(TaskService);

describe("AsyncMessagePollingHandler", () => {
	const baseEnv = {
		DB: {} as any,
	} as unknown as IEnv;

	const baseMessage: TaskMessage = {
		taskId: "test-task",
		task_type: "async_message_polling",
		user_id: 1,
		task_data: {
			conversationId: "conv-123",
			messageId: "msg-456",
			asyncInvocation: {
				provider: "replicate",
				id: "async-789",
				status: "in_progress",
			},
			userId: 1,
		},
		priority: 7,
	};

	let handler: AsyncMessagePollingHandler;

	beforeEach(() => {
		vi.resetAllMocks();
		handler = new AsyncMessagePollingHandler();
	});

	it("returns error when required fields are missing", async () => {
		const message = {
			...baseMessage,
			task_data: { userId: 1 },
		};

		const result = await handler.handle(message as any, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain(
			"conversationId, messageId, and asyncInvocation are required",
		);
	});

	it("returns error when message not found", async () => {
		mockedDatabase.getInstance.mockReturnValue({} as any);

		const mockConversationManager = {
			get: vi.fn().mockResolvedValue([]),
		};
		mockedConversationManager.getInstance.mockReturnValue(
			mockConversationManager as any,
		);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("not found in conversation");
	});

	it("skips processing when message not pending async invocation", async () => {
		mockedDatabase.getInstance.mockReturnValue({} as any);

		const mockConversationManager = {
			get: vi.fn().mockResolvedValue([
				{
					id: "msg-456",
					data: {
						asyncInvocation: {
							status: "completed",
						},
					},
				},
			]),
		};
		mockedConversationManager.getInstance.mockReturnValue(
			mockConversationManager as any,
		);

		mockedIsAsyncInvocationPending.mockReturnValue(false);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toContain("not pending async invocation");
	});

	it("handles completed async invocation", async () => {
		mockedDatabase.getInstance.mockReturnValue({} as any);

		const mockConversationManager = {
			get: vi.fn().mockResolvedValue([
				{
					id: "msg-456",
					data: {
						asyncInvocation: {
							provider: "replicate",
							id: "async-789",
							status: "in_progress",
						},
					},
				},
			]),
		};
		mockedConversationManager.getInstance.mockReturnValue(
			mockConversationManager as any,
		);

		mockedIsAsyncInvocationPending.mockReturnValue(true);
		mockedHandleAsyncInvocation.mockResolvedValue({
			status: "completed",
		} as any);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Async invocation completed");
		expect(result.data).toMatchObject({
			messageId: "msg-456",
			invocationStatus: "completed",
		});
	});

	it("handles failed async invocation", async () => {
		mockedDatabase.getInstance.mockReturnValue({} as any);

		const mockConversationManager = {
			get: vi.fn().mockResolvedValue([
				{
					id: "msg-456",
					data: {
						asyncInvocation: {
							provider: "replicate",
							id: "async-789",
							status: "in_progress",
						},
					},
				},
			]),
		};
		mockedConversationManager.getInstance.mockReturnValue(
			mockConversationManager as any,
		);

		mockedIsAsyncInvocationPending.mockReturnValue(true);
		mockedHandleAsyncInvocation.mockResolvedValue({
			status: "failed",
		} as any);

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("success");
		expect(result.message).toBe("Async invocation failed");
	});

	it("re-queues task when async invocation still in progress", async () => {
		mockedDatabase.getInstance.mockReturnValue({} as any);

		const mockConversationManager = {
			get: vi.fn().mockResolvedValue([
				{
					id: "msg-456",
					data: {
						asyncInvocation: {
							provider: "replicate",
							id: "async-789",
							status: "in_progress",
						},
					},
				},
			]),
		};
		mockedConversationManager.getInstance.mockReturnValue(
			mockConversationManager as any,
		);

		mockedIsAsyncInvocationPending.mockReturnValue(true);
		mockedHandleAsyncInvocation.mockResolvedValue({
			status: "in_progress",
		} as any);

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
				task_type: "async_message_polling",
			}),
		);
	});

	it("handles errors gracefully", async () => {
		mockedDatabase.getInstance.mockImplementation(() => {
			throw new Error("Database error");
		});

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toBe("Database error");
	});
});
