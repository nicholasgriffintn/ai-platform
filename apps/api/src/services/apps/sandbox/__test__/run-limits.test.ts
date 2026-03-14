import { describe, expect, it, vi } from "vitest";

import { assertSandboxRunCanStart } from "../run-limits";

function toRunData(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		runId: `run-${Math.random().toString(36).slice(2, 8)}`,
		installationId: 1,
		repo: "owner/repo",
		task: "Implement feature",
		model: "mistral-large",
		shouldCommit: true,
		status: "completed",
		startedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	});
}

describe("assertSandboxRunCanStart", () => {
	it("allows starts when under quota and rate limits", async () => {
		const getAppDataByUserAndApp = vi.fn().mockResolvedValue([]);
		const context = {
			env: {},
			repositories: {
				appData: { getAppDataByUserAndApp },
			},
		} as any;

		await expect(
			assertSandboxRunCanStart({
				context,
				userId: 42,
				now: new Date("2026-02-17T12:00:00.000Z"),
			}),
		).resolves.toBeUndefined();
	});

	it("rejects when concurrent active run limit is reached", async () => {
		const getAppDataByUserAndApp = vi.fn().mockResolvedValue([
			{
				data: toRunData({
					status: "running",
				}),
			},
			{
				data: toRunData({
					status: "paused",
				}),
			},
		]);
		const context = {
			env: {},
			repositories: {
				appData: { getAppDataByUserAndApp },
			},
		} as any;

		await expect(
			assertSandboxRunCanStart({
				context,
				userId: 42,
				now: new Date("2026-02-17T12:00:00.000Z"),
			}),
		).rejects.toThrow("concurrency limit");
	});

	it("rejects when per-minute start rate is exceeded", async () => {
		const now = new Date("2026-02-17T12:00:00.000Z");
		const getAppDataByUserAndApp = vi.fn().mockResolvedValue([
			{
				data: toRunData({
					status: "completed",
					startedAt: "2026-02-17T11:59:40.000Z",
				}),
			},
			{
				data: toRunData({
					status: "failed",
					startedAt: "2026-02-17T11:59:45.000Z",
				}),
			},
			{
				data: toRunData({
					status: "cancelled",
					startedAt: "2026-02-17T11:59:50.000Z",
				}),
			},
			{
				data: toRunData({
					status: "completed",
					startedAt: "2026-02-17T11:59:55.000Z",
				}),
			},
		]);
		const context = {
			env: {},
			repositories: {
				appData: { getAppDataByUserAndApp },
			},
		} as any;

		await expect(
			assertSandboxRunCanStart({
				context,
				userId: 42,
				now,
			}),
		).rejects.toThrow("starts per minute");
	});
});
