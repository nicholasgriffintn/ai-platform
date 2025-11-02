import { describe, expect, it, beforeEach, vi } from "vitest";
import type { IEnv } from "~/types";
import { ErrorType } from "~/utils/errors";
import { getAuxiliaryResearchProvider } from "~/lib/models";
import { Research } from "~/lib/research";
import {
	getResearchTaskStatus,
	handleResearchTask,
	startResearchTask,
} from "../task";

vi.mock("~/lib/models", () => ({
	getAuxiliaryResearchProvider: vi.fn(),
}));

vi.mock("~/lib/research", () => ({
	Research: {
		getInstance: vi.fn(),
	},
}));

const mockedGetAuxiliaryResearchProvider = vi.mocked(
	getAuxiliaryResearchProvider,
);
const mockedResearchGetInstance = vi.mocked(Research.getInstance);

describe("handleResearchTask", () => {
	const baseEnv = {
		ACCOUNT_ID: "test",
	} as unknown as IEnv;

	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("runs research with sanitized string input", async () => {
		const mockRun = vi.fn().mockResolvedValue({
			provider: "parallel",
			run: {
				run_id: "test-run",
				status: "completed",
				is_active: false,
				processor: "ultra",
				created_at: new Date().toISOString(),
				modified_at: new Date().toISOString(),
			},
			output: {
				content: "Result content",
			},
			poll: {
				attempts: 1,
				interval_ms: 5000,
				timeout_seconds: 25,
				elapsed_ms: 1000,
			},
		});

		mockedGetAuxiliaryResearchProvider.mockResolvedValue("parallel");
		mockedResearchGetInstance.mockReturnValue({
			run: mockRun,
		} as any);

		const response = await handleResearchTask({
			env: baseEnv,
			input: "   test query   ",
		});

		expect(mockedGetAuxiliaryResearchProvider).toHaveBeenCalledWith(
			baseEnv,
			undefined,
			undefined,
		);
		expect(mockRun).toHaveBeenCalledWith("test query", undefined);
		expect(response).toMatchObject({
			status: "success",
			data: {
				provider: "parallel",
				run: expect.objectContaining({ run_id: "test-run" }),
			},
		});
	});

	it("throws when research provider returns an error result", async () => {
		mockedGetAuxiliaryResearchProvider.mockResolvedValue("parallel");
		mockedResearchGetInstance.mockReturnValue({
			run: vi.fn().mockResolvedValue({
				status: "error",
				error: "Failed",
			}),
		} as any);

		await expect(
			handleResearchTask({
				env: baseEnv,
				input: "query",
			}),
		).rejects.toMatchObject({
			type: ErrorType.EXTERNAL_API_ERROR,
			message: "Failed",
		});
	});

	it("throws when input is an empty object", async () => {
		await expect(
			handleResearchTask({
				env: baseEnv,
				input: {},
			}),
		).rejects.toMatchObject({
			type: ErrorType.PARAMS_ERROR,
		});
	});
	it("starts research task without waiting for completion", async () => {
		const mockCreateTask = vi.fn().mockResolvedValue({
			provider: "parallel",
			run: {
				run_id: "start-run",
				status: "queued",
				is_active: true,
				processor: "ultra",
				created_at: new Date().toISOString(),
				modified_at: new Date().toISOString(),
			},
		});

		mockedGetAuxiliaryResearchProvider.mockResolvedValue("parallel");
		mockedResearchGetInstance.mockReturnValue({
			createTask: mockCreateTask,
		} as any);

		const handle = await startResearchTask({
			env: baseEnv,
			input: " Start my research ",
		});

		expect(mockCreateTask).toHaveBeenCalledWith("Start my research", undefined);
		expect(handle).toMatchObject({
			provider: "parallel",
			run: expect.objectContaining({
				run_id: "start-run",
				status: "queued",
			}),
		});
	});

	it("fetches research task status", async () => {
		const mockFetchResult = vi.fn().mockResolvedValue({
			provider: "parallel",
			run: {
				run_id: "status-run",
				status: "running",
				is_active: true,
				processor: "ultra",
				created_at: new Date().toISOString(),
				modified_at: new Date().toISOString(),
			},
			warnings: ["working"],
		});

		mockedGetAuxiliaryResearchProvider.mockResolvedValue("parallel");
		mockedResearchGetInstance.mockReturnValue({
			fetchResult: mockFetchResult,
		} as any);

		const status = await getResearchTaskStatus({
			env: baseEnv,
			runId: "status-run",
		});

		expect(mockFetchResult).toHaveBeenCalledWith("status-run", undefined);
		expect(status).toMatchObject({
			provider: "parallel",
			run: expect.objectContaining({ status: "running" }),
			warnings: ["working"],
		});
	});
});
