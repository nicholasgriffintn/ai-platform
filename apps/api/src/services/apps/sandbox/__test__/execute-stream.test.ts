import { beforeEach, describe, expect, it, vi } from "vitest";

import { SANDBOX_RUN_ITEM_TYPE, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import { resolveSandboxModel } from "~/services/sandbox/worker";
import { executeSandboxRunStream } from "../execute-stream";
import {
	appendRunCoordinatorEvent,
	initRunCoordinatorControl,
	listRunCoordinatorEvents,
	updateRunCoordinatorControl,
} from "../run-coordinator";

vi.mock("~/services/sandbox/worker", () => ({
	resolveSandboxModel: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(() => "run-123"),
}));

vi.mock("../run-coordinator", () => ({
	appendRunCoordinatorEvent: vi.fn(),
	initRunCoordinatorControl: vi.fn(),
	listRunCoordinatorEvents: vi.fn(),
	updateRunCoordinatorControl: vi.fn(),
}));

const mockCreateAppDataWithItem = vi.fn();
const mockUpdateAppData = vi.fn();
const mockGetAppDataByUserAndApp = vi.fn();

const mockContext = {
	repositories: {
		appData: {
			createAppDataWithItem: mockCreateAppDataWithItem,
			updateAppData: mockUpdateAppData,
			getAppDataByUserAndApp: mockGetAppDataByUserAndApp,
		},
	},
} as any;

const mockUser = { id: 42 } as any;

describe("executeSandboxRunStream", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateAppDataWithItem.mockResolvedValue({ id: "record-1" });
		mockUpdateAppData.mockResolvedValue(undefined);
		mockGetAppDataByUserAndApp.mockResolvedValue([]);
		vi.mocked(resolveSandboxModel).mockResolvedValue("mistral-large");
		vi.mocked(listRunCoordinatorEvents).mockResolvedValue([
			{
				index: 1,
				recordedAt: "2026-03-15T12:00:00.000Z",
				event: {
					type: "run_completed",
					runId: "run-123",
					timestamp: "2026-03-15T12:00:00.000Z",
				},
			},
		]);
	});

	it("queues sandbox runs and returns a coordinator-backed stream", async () => {
		const queueSend = vi.fn().mockResolvedValue(undefined);
		const response = await executeSandboxRunStream({
			env: {
				TASK_QUEUE: {
					send: queueSend,
				},
			} as any,
			context: mockContext,
			user: mockUser,
			payload: {
				installationId: 99,
				repo: "owner/repo",
				task: "Implement feature",
			},
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("x-sandbox-run-id")).toBe("run-123");
		expect(queueSend).toHaveBeenCalledTimes(1);
		expect(mockCreateAppDataWithItem).toHaveBeenCalledWith(
			42,
			SANDBOX_RUNS_APP_ID,
			"run-123",
			SANDBOX_RUN_ITEM_TYPE,
			expect.objectContaining({
				status: "queued",
				workflowPhase: "queued",
			}),
		);
		expect(initRunCoordinatorControl).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				runId: "run-123",
				state: "queued",
			}),
		);
		expect(appendRunCoordinatorEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				runId: "run-123",
				event: expect.objectContaining({
					type: "run_queued",
				}),
			}),
		);

		expect(await response.text()).toContain("run_completed");
	});

	it("marks runs as failed when dispatch cannot be queued", async () => {
		const response = await executeSandboxRunStream({
			env: {} as any,
			context: mockContext,
			user: mockUser,
			payload: {
				installationId: 99,
				repo: "owner/repo",
				task: "Implement feature",
			},
		});

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "TASK_QUEUE binding is not configured for sandbox run dispatch",
		});
		expect(mockUpdateAppData).toHaveBeenCalledWith(
			"record-1",
			expect.objectContaining({
				status: "failed",
				workflowPhase: "failed",
			}),
		);
		expect(updateRunCoordinatorControl).toHaveBeenCalledWith(
			expect.objectContaining({
				runId: "run-123",
				state: "cancelled",
			}),
		);
	});

	it("streams coordinator events until terminal and advances cursor", async () => {
		vi.mocked(listRunCoordinatorEvents)
			.mockResolvedValueOnce([
				{
					index: 1,
					recordedAt: "2026-03-15T12:00:00.000Z",
					event: {
						type: "run_started",
						runId: "run-123",
						timestamp: "2026-03-15T12:00:00.000Z",
					},
				},
			])
			.mockResolvedValueOnce([
				{
					index: 2,
					recordedAt: "2026-03-15T12:00:01.000Z",
					event: {
						type: "run_failed",
						runId: "run-123",
						error: "failed",
						timestamp: "2026-03-15T12:00:01.000Z",
					},
				},
			]);

		const queueSend = vi.fn().mockResolvedValue(undefined);
		const response = await executeSandboxRunStream({
			env: {
				TASK_QUEUE: {
					send: queueSend,
				},
			} as any,
			context: mockContext,
			user: mockUser,
			payload: {
				installationId: 99,
				repo: "owner/repo",
				task: "Implement feature",
			},
		});

		const streamText = await response.text();
		expect(streamText).toContain("run_started");
		expect(streamText).toContain("run_failed");
		expect(streamText).toContain("[DONE]");
		expect(listRunCoordinatorEvents).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				runId: "run-123",
				after: 0,
			}),
		);
		expect(listRunCoordinatorEvents).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				runId: "run-123",
				after: 1,
			}),
		);
	});
});
