import { describe, expect, it, beforeEach, vi } from "vitest";
import type { IEnv, User } from "~/types";
import { AsyncMessagePollingHandler } from "../AsyncMessagePollingHandler";
import { ConversationManager } from "~/lib/conversationManager";
import { handleAsyncInvocation } from "~/services/completions/async/handler";
import { isAsyncInvocationPending } from "~/lib/async/asyncInvocation";
import type { TaskMessage } from "../../TaskService";

const mockDatabase = {
	repositories: {
		conversations: {
			get: vi.fn(),
			updateMessage: vi.fn(),
		},
	},
};

vi.mock("~/lib/database", () => ({
	Database: class {
		constructor() {
			return mockDatabase;
		}
	},
}));

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: vi.fn(),
	},
}));

vi.mock("~/services/completions/async/handler");
vi.mock("~/lib/async/asyncInvocation");

let taskRepositoryImpl: any;
let taskServiceImpl: any;
let userRepositoryFactory = () => ({
	getUserById: vi.fn(),
});

vi.mock("~/repositories/TaskRepository", () => ({
	TaskRepository: class {
		constructor() {
			return taskRepositoryImpl ?? {};
		}
	},
}));

vi.mock("~/repositories/UserRepository", () => ({
	UserRepository: class {
		constructor() {
			return userRepositoryFactory();
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

const mockedConversationManager = vi.mocked(ConversationManager);
const mockedHandleAsyncInvocation = vi.mocked(handleAsyncInvocation);
const mockedIsAsyncInvocationPending = vi.mocked(isAsyncInvocationPending);

describe("AsyncMessagePollingHandler", () => {
	const baseEnv = {
		DB: {} as any,
	} as unknown as IEnv;

	const mockUser: User = {
		id: 1,
		name: "Test User",
		avatar_url: null,
		email: "test@example.com",
		github_username: "testuser",
		company: null,
		site: null,
		location: null,
		bio: null,
		twitter_username: null,
		role: null,
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		setup_at: null,
		terms_accepted_at: null,
		plan_id: null,
	};

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
		taskRepositoryImpl = undefined;
		taskServiceImpl = undefined;
		handler = new AsyncMessagePollingHandler();

		// Mock UserRepository to return a valid user
		userRepositoryFactory = () => ({
			getUserById: vi.fn().mockResolvedValue(mockUser),
		});
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

	it("returns error when user not found", async () => {
		// Override the default mock to return null
		userRepositoryFactory = () => ({
			getUserById: vi.fn().mockResolvedValue(null),
		});

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toContain("User 1 not found");
	});

	it("returns error when message not found", async () => {
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

	it("returns success when message is not pending async invocation", async () => {
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
	});

	it("re-queues task when async invocation still in progress", async () => {
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
		taskServiceImpl = {
			enqueueTask: mockEnqueueTask,
		};

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
		// Mock UserRepository to throw an error
		userRepositoryFactory = () => {
			throw new Error("Database error");
		};

		const result = await handler.handle(baseMessage, baseEnv);

		expect(result.status).toBe("error");
		expect(result.message).toBe("Database error");
	});
});
