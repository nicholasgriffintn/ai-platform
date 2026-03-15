import { beforeEach, describe, expect, it, vi } from "vitest";
import { SANDBOX_RUN_DISPATCH_TASK_TYPE } from "@assistant/schemas";

import {
	enqueueSandboxRunDispatchTask,
	isSandboxRunDispatchMessage,
	processSandboxRunDispatch,
} from "../dispatch";
import { createServiceContext } from "~/lib/context/serviceContext";
import { executeSandboxWorker } from "~/services/sandbox/worker";
import {
	appendRunCoordinatorEvent,
	updateRunCoordinatorControl,
} from "../run-coordinator";
import { persistSandboxRunArtifact } from "../run-artifacts";
import { indexSandboxRunResult } from "../run-indexing";

const mockEnqueueTask = vi.fn();

vi.mock("~/lib/context/serviceContext", () => ({
	createServiceContext: vi.fn(),
}));
vi.mock("~/services/sandbox/worker", () => ({
	executeSandboxWorker: vi.fn(),
}));
vi.mock("../run-coordinator", () => ({
	appendRunCoordinatorEvent: vi.fn(),
	updateRunCoordinatorControl: vi.fn(),
}));
vi.mock("../run-artifacts", () => ({
	persistSandboxRunArtifact: vi.fn(async ({ run }) => run),
}));
vi.mock("../run-indexing", () => ({
	indexSandboxRunResult: vi.fn(async () => undefined),
}));
vi.mock("~/services/tasks/TaskService", () => ({
	TaskService: class {
		public enqueueTask = mockEnqueueTask;
	},
}));

const mockGetUserById = vi.fn();
const mockGetAppDataById = vi.fn();
const mockUpdateAppData = vi.fn();

const mockServiceContext = {
	env: {},
	repositories: {
		users: {
			getUserById: mockGetUserById,
		},
		appData: {
			getAppDataById: mockGetAppDataById,
			updateAppData: mockUpdateAppData,
		},
		tasks: {},
	},
} as any;

const baseRunRecord = {
	runId: "run-123",
	installationId: 99,
	repo: "owner/repo",
	task: "Implement feature",
	model: "mistral-large",
	shouldCommit: true,
	status: "queued",
	startedAt: "2026-03-15T12:00:00.000Z",
	updatedAt: "2026-03-15T12:00:00.000Z",
	events: [],
	timeoutSeconds: 900,
	timeoutAt: "2026-03-15T12:15:00.000Z",
};

describe("sandbox dispatch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createServiceContext).mockReturnValue(mockServiceContext);
		mockGetUserById.mockResolvedValue({
			id: 42,
			email: "dev@example.com",
			name: "Dev",
		});
		mockGetAppDataById.mockResolvedValue({
			data: JSON.stringify(baseRunRecord),
		});
		mockEnqueueTask.mockResolvedValue("task-123");
		mockUpdateAppData.mockResolvedValue(undefined);
		vi.mocked(executeSandboxWorker).mockResolvedValue(
			Response.json({
				success: true,
				summary: "Completed",
			}),
		);
	});

	it("validates sandbox dispatch message shape", () => {
		expect(
			isSandboxRunDispatchMessage({
				kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
				runId: "run-1",
				recordId: "record-1",
				userId: 1,
				payload: {
					installationId: 1,
					repo: "owner/repo",
					task: "Task",
					shouldCommit: false,
				},
			}),
		).toBe(true);
		expect(
			isSandboxRunDispatchMessage({
				kind: "other",
				runId: "run-1",
			}),
		).toBe(false);
	});

	it("enqueues dispatch message via shared task service", async () => {
		const taskId = await enqueueSandboxRunDispatchTask({
			context: {
				env: {
					TASK_QUEUE: { send: vi.fn() },
				},
				repositories: {
					tasks: {},
				},
			} as any,
			message: {
				kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
				runId: "run-1",
				recordId: "record-1",
				userId: 1,
				payload: {
					installationId: 1,
					repo: "owner/repo",
					task: "Task",
					shouldCommit: false,
				},
			},
		});
		expect(taskId).toBe("task-123");
		expect(mockEnqueueTask).toHaveBeenCalledWith(
			expect.objectContaining({
				task_type: SANDBOX_RUN_DISPATCH_TASK_TYPE,
				user_id: 1,
				task_data: expect.objectContaining({
					kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
					runId: "run-1",
				}),
			}),
		);
	});

	it("rejects dispatch enqueue when TASK_QUEUE is unavailable", async () => {
		await expect(
			enqueueSandboxRunDispatchTask({
				context: {
					env: {},
					repositories: {
						tasks: {},
					},
				} as any,
				message: {
					kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
					runId: "run-1",
					recordId: "record-1",
					userId: 1,
					payload: {
						installationId: 1,
						repo: "owner/repo",
						task: "Task",
						shouldCommit: false,
					},
				},
			}),
		).rejects.toThrow(
			"TASK_QUEUE binding is not configured for sandbox run dispatch",
		);
	});

	it("processes queued runs and persists completed state", async () => {
		await processSandboxRunDispatch({
			env: {} as any,
			message: {
				kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
				runId: "run-123",
				recordId: "record-1",
				userId: 42,
				payload: {
					installationId: 99,
					repo: "owner/repo",
					task: "Implement feature",
					model: "mistral-large",
					shouldCommit: true,
				},
			},
		});

		expect(executeSandboxWorker).toHaveBeenCalledWith(
			expect.objectContaining({
				runId: "run-123",
				repo: "owner/repo",
			}),
		);
		expect(mockUpdateAppData).toHaveBeenCalled();
		expect(updateRunCoordinatorControl).toHaveBeenCalledWith(
			expect.objectContaining({
				runId: "run-123",
				state: "running",
			}),
		);
		expect(updateRunCoordinatorControl).toHaveBeenLastCalledWith(
			expect.objectContaining({
				runId: "run-123",
				state: "cancelled",
			}),
		);
		expect(appendRunCoordinatorEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				runId: "run-123",
				event: expect.objectContaining({
					type: "run_completed",
				}),
			}),
		);
		expect(persistSandboxRunArtifact).toHaveBeenCalled();
		expect(indexSandboxRunResult).toHaveBeenCalled();
	});

	it("marks queued runs as failed when worker startup throws", async () => {
		vi.mocked(executeSandboxWorker).mockRejectedValueOnce(
			new Error("worker startup failed"),
		);

		await processSandboxRunDispatch({
			env: {} as any,
			message: {
				kind: SANDBOX_RUN_DISPATCH_TASK_TYPE,
				runId: "run-123",
				recordId: "record-1",
				userId: 42,
				payload: {
					installationId: 99,
					repo: "owner/repo",
					task: "Implement feature",
					model: "mistral-large",
					shouldCommit: true,
				},
			},
		});

		expect(mockUpdateAppData).toHaveBeenLastCalledWith(
			"record-1",
			expect.objectContaining({
				status: "failed",
				workflowPhase: "failed",
				error: "worker startup failed",
			}),
		);
		expect(appendRunCoordinatorEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				runId: "run-123",
				event: expect.objectContaining({
					type: "run_failed",
					error: "worker startup failed",
				}),
			}),
		);
		expect(updateRunCoordinatorControl).toHaveBeenLastCalledWith(
			expect.objectContaining({
				runId: "run-123",
				state: "cancelled",
				cancellationReason: "worker startup failed",
			}),
		);
		expect(indexSandboxRunResult).not.toHaveBeenCalled();
	});
});
