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

const mockContext = {
	repositories: {
		appData: {
			createAppDataWithItem: mockCreateAppDataWithItem,
			updateAppData: mockUpdateAppData,
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
				shouldCommit: true,
				status: "completed",
			}),
		});
		expect(mockUpdateAppData).toHaveBeenCalledTimes(2);
		expect(mockUpdateAppData.mock.calls[1]?.[1]).toMatchObject({
			status: "completed",
			result: {
				success: true,
				result: { ok: true },
			},
		});
	});
});
