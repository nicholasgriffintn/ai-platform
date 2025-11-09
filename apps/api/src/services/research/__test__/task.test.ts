import { describe, expect, it, beforeEach, vi } from "vitest";
import type { IEnv } from "~/types";
import { ErrorType } from "~/utils/errors";
import { getAuxiliaryResearchProvider } from "~/lib/providers/models";
import { getResearchProvider } from "~/lib/providers/capabilities/research";
import {
	getResearchTaskStatus,
	handleResearchTask,
	startResearchTask,
} from "../task";

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryResearchProvider: vi.fn(),
}));

vi.mock("~/lib/providers/capabilities/research", () => ({
	getResearchProvider: vi.fn(),
}));

const mockedGetAuxiliaryResearchProvider = vi.mocked(
	getAuxiliaryResearchProvider,
);
const mockedGetResearchProvider = vi.mocked(getResearchProvider);

describe("handleResearchTask", () => {
	const baseEnv = {
		ACCOUNT_ID: "test",
	} as unknown as IEnv;

	let mockResearchProvider: {
		performResearch: ReturnType<typeof vi.fn>;
		createResearchTask: ReturnType<typeof vi.fn>;
		fetchResearchResult: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.resetAllMocks();
		mockResearchProvider = {
			performResearch: vi.fn(),
			createResearchTask: vi.fn(),
			fetchResearchResult: vi.fn(),
		};
		mockedGetResearchProvider.mockReturnValue(mockResearchProvider as any);
	});

	it("runs research with sanitized string input", async () => {
		mockResearchProvider.performResearch.mockResolvedValue({
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

		const response = await handleResearchTask({
			env: baseEnv,
			input: "   test query   ",
		});

		expect(mockedGetAuxiliaryResearchProvider).toHaveBeenCalledWith(
			baseEnv,
			undefined,
			undefined,
		);
		expect(mockedGetResearchProvider).toHaveBeenCalledWith("parallel", {
			env: baseEnv,
			user: undefined,
		});
		expect(mockResearchProvider.performResearch).toHaveBeenCalledWith(
			"test query",
			undefined,
		);
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
		mockResearchProvider.performResearch.mockResolvedValue({
			status: "error",
			error: "Failed",
		});

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
		mockResearchProvider.createResearchTask.mockResolvedValue({
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

		const handle = await startResearchTask({
			env: baseEnv,
			input: " Start my research ",
		});

		expect(mockResearchProvider.createResearchTask).toHaveBeenCalledWith(
			"Start my research",
			undefined,
		);
		expect(handle).toMatchObject({
			provider: "parallel",
			run: expect.objectContaining({
				run_id: "start-run",
				status: "queued",
			}),
		});
	});

	it("fetches research task status", async () => {
		mockResearchProvider.fetchResearchResult.mockResolvedValue({
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

		const status = await getResearchTaskStatus({
			env: baseEnv,
			runId: "status-run",
		});

		expect(mockResearchProvider.fetchResearchResult).toHaveBeenCalledWith(
			"status-run",
			undefined,
		);
		expect(status).toMatchObject({
			provider: "parallel",
			run: expect.objectContaining({ status: "running" }),
			warnings: ["working"],
		});
	});
});
