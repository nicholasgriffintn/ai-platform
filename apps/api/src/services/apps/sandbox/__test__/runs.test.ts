import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getSandboxRunControlState,
	requestSandboxRunPause,
	requestSandboxRunResume,
} from "../runs";

function buildRunData(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		runId: "run-123",
		installationId: 11,
		repo: "owner/repo",
		task: "Implement feature",
		model: "mistral-large",
		shouldCommit: true,
		status: "running",
		startedAt: "2026-02-17T12:00:00.000Z",
		updatedAt: "2026-02-17T12:00:05.000Z",
		...overrides,
	});
}

describe("sandbox runs service", () => {
	const mockGetAppDataByUserAppAndItem = vi.fn();
	const mockUpdateAppData = vi.fn();

	const context = {
		repositories: {
			appData: {
				getAppDataByUserAppAndItem: mockGetAppDataByUserAppAndItem,
				updateAppData: mockUpdateAppData,
			},
		},
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("pauses a running run", async () => {
		mockGetAppDataByUserAppAndItem.mockResolvedValue([
			{
				id: "record-1",
				data: buildRunData(),
			},
		]);

		const result = await requestSandboxRunPause({
			context,
			userId: 42,
			runId: "run-123",
			reason: "Paused from test",
		});

		expect(result.paused).toBe(true);
		expect(result.run.status).toBe("paused");
		expect(mockUpdateAppData).toHaveBeenCalledWith(
			"record-1",
			expect.objectContaining({
				status: "paused",
				pauseReason: "Paused from test",
			}),
		);
	});

	it("resumes a paused run", async () => {
		mockGetAppDataByUserAppAndItem.mockResolvedValue([
			{
				id: "record-1",
				data: buildRunData({
					status: "paused",
					pausedAt: "2026-02-17T12:00:30.000Z",
				}),
			},
		]);

		const result = await requestSandboxRunResume({
			context,
			userId: 42,
			runId: "run-123",
			reason: "Resumed from test",
		});

		expect(result.resumed).toBe(true);
		expect(result.run.status).toBe("running");
		expect(mockUpdateAppData).toHaveBeenCalledWith(
			"record-1",
			expect.objectContaining({
				status: "running",
				resumeReason: "Resumed from test",
			}),
		);
	});

	it("returns paused control state for paused runs", async () => {
		mockGetAppDataByUserAppAndItem.mockResolvedValue([
			{
				id: "record-1",
				data: buildRunData({
					status: "paused",
					pauseReason: "Paused from dashboard",
					timeoutSeconds: 1200,
				}),
			},
		]);

		const control = await getSandboxRunControlState({
			context,
			userId: 42,
			runId: "run-123",
		});

		expect(control).toMatchObject({
			runId: "run-123",
			state: "paused",
			pauseReason: "Paused from dashboard",
			timeoutSeconds: 1200,
		});
	});
});
