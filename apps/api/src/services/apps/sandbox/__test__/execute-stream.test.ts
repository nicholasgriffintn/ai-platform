import { beforeEach, describe, expect, it, vi } from "vitest";

import { SANDBOX_RUN_ITEM_TYPE, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import {
	executeSandboxWorker,
	resolveSandboxModel,
} from "~/services/sandbox/worker";
import { executeSandboxRunStream } from "../execute-stream";

vi.mock("~/services/sandbox/worker", () => ({
	executeSandboxWorker: vi.fn(),
	resolveSandboxModel: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(() => "run-123"),
}));

const mockCreateAppDataWithItem = vi.fn();
const mockUpdateAppData = vi.fn();
const mockGetAppDataById = vi.fn();

const mockContext = {
	repositories: {
		appData: {
			createAppDataWithItem: mockCreateAppDataWithItem,
			updateAppData: mockUpdateAppData,
			getAppDataById: mockGetAppDataById,
		},
	},
} as any;

const mockUser = { id: 42 } as any;
const mockEnv = {} as any;

describe("executeSandboxRunStream", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateAppDataWithItem.mockResolvedValue({ id: "record-1" });
		mockUpdateAppData.mockResolvedValue(undefined);
		mockGetAppDataById.mockResolvedValue(null);
		vi.mocked(resolveSandboxModel).mockResolvedValue("mistral-large");
	});

	it("persists a failed run when starting the worker throws", async () => {
		vi.mocked(executeSandboxWorker).mockRejectedValue(
			new Error("worker failed"),
		);

		const response = await executeSandboxRunStream({
			env: mockEnv,
			context: mockContext,
			user: mockUser,
			payload: {
				installationId: 99,
				repo: "owner/repo",
				task: "Implement feature",
			},
		});

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: "worker failed" });
		expect(mockCreateAppDataWithItem).toHaveBeenCalledWith(
			42,
			SANDBOX_RUNS_APP_ID,
			"run-123",
			SANDBOX_RUN_ITEM_TYPE,
			expect.objectContaining({
				runId: "run-123",
				status: "queued",
			}),
		);
		expect(mockUpdateAppData).toHaveBeenCalledTimes(2);
		expect(mockUpdateAppData.mock.calls[0]?.[1]).toMatchObject({
			status: "running",
		});
		expect(mockUpdateAppData.mock.calls[1]?.[1]).toMatchObject({
			status: "failed",
			error: "worker failed",
		});
	});

	it("returns run data for non-stream worker responses and persists completion", async () => {
		vi.mocked(executeSandboxWorker).mockResolvedValue(
			Response.json({
				success: true,
				result: { ok: true },
			}),
		);

		const response = await executeSandboxRunStream({
			env: mockEnv,
			context: mockContext,
			user: mockUser,
			payload: {
				installationId: 100,
				repo: "owner/repo",
				task: "Ship it",
				promptStrategy: "bug-fix",
				shouldCommit: true,
			},
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			run: expect.objectContaining({
				runId: "run-123",
				installationId: 100,
				repo: "owner/repo",
				task: "Ship it",
				model: "mistral-large",
				promptStrategy: "bug-fix",
				shouldCommit: true,
				status: "completed",
			}),
		});
		expect(executeSandboxWorker).toHaveBeenCalledWith(
			expect.objectContaining({
				promptStrategy: "bug-fix",
			}),
		);
		expect(mockUpdateAppData).toHaveBeenCalledTimes(2);
		expect(mockUpdateAppData.mock.calls[1]?.[1]).toMatchObject({
			status: "completed",
			promptStrategy: "bug-fix",
			result: {
				success: true,
				result: { ok: true },
			},
		});
	});

	it("preserves cancelled status when a cancellation was already persisted", async () => {
		vi.mocked(executeSandboxWorker).mockResolvedValue(
			Response.json({
				success: true,
				result: { ok: true },
			}),
		);
		mockGetAppDataById.mockResolvedValue({
			data: JSON.stringify({
				runId: "run-123",
				installationId: 100,
				repo: "owner/repo",
				task: "Ship it",
				model: "mistral-large",
				shouldCommit: true,
				status: "cancelled",
				startedAt: "2026-02-17T12:00:00.000Z",
				updatedAt: "2026-02-17T12:00:01.000Z",
				completedAt: "2026-02-17T12:00:01.000Z",
				cancelRequestedAt: "2026-02-17T12:00:01.000Z",
				cancellationReason: "Cancelled by user request",
			}),
		});

		const response = await executeSandboxRunStream({
			env: mockEnv,
			context: mockContext,
			user: mockUser,
			payload: {
				installationId: 100,
				repo: "owner/repo",
				task: "Ship it",
				shouldCommit: true,
			},
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			run: expect.objectContaining({
				runId: "run-123",
				status: "cancelled",
				cancellationReason: "Cancelled by user request",
			}),
		});
		expect(mockUpdateAppData.mock.calls[1]?.[1]).toMatchObject({
			status: "cancelled",
		});
	});
});
