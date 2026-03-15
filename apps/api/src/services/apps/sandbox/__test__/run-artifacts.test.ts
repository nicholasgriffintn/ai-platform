import { describe, expect, it, vi } from "vitest";

import { persistSandboxRunArtifact } from "../run-artifacts";

describe("run artifacts", () => {
	it("persists manifest and file artifacts and strips large inline result fields", async () => {
		const put = vi.fn().mockResolvedValue(undefined);
		const context = {
			env: {
				ASSETS_BUCKET: { put },
				PUBLIC_ASSETS_URL: "https://assets.example.com",
			},
		} as any;

		const run = {
			runId: "run:123",
			installationId: 99,
			repo: "owner/repo",
			task: "Implement feature",
			model: "mistral-large",
			shouldCommit: true,
			status: "completed",
			startedAt: "2026-03-15T12:00:00.000Z",
			updatedAt: "2026-03-15T12:01:00.000Z",
			completedAt: "2026-03-15T12:01:00.000Z",
			events: [{ type: "run_completed" }],
			result: {
				success: true,
				logs: "full logs",
				diff: "diff --git a b",
				summary: "done",
			},
		} as any;

		const persisted = await persistSandboxRunArtifact({
			serviceContext: context,
			run,
		});

		expect(put).toHaveBeenCalledTimes(5);
		expect(persisted.artifactKey).toMatch(
			/sandbox\/runs\/run-123\/manifest\.json$/,
		);
		expect(persisted.result?.logs).toBeUndefined();
		expect(persisted.result?.diff).toBeUndefined();
		expect(persisted.result?.artifactItems).toHaveLength(4);
		expect(persisted.result?.logsArtifactUrl).toMatch(
			/^https:\/\/assets\.example\.com\//,
		);
	});

	it("returns input unchanged when there is nothing to persist", async () => {
		const put = vi.fn().mockResolvedValue(undefined);
		const context = {
			env: {
				ASSETS_BUCKET: { put },
				PUBLIC_ASSETS_URL: "https://assets.example.com",
			},
		} as any;

		const run = {
			runId: "run-1",
			installationId: 99,
			repo: "owner/repo",
			task: "Implement feature",
			model: "mistral-large",
			shouldCommit: true,
			status: "running",
			startedAt: "2026-03-15T12:00:00.000Z",
			updatedAt: "2026-03-15T12:00:01.000Z",
			events: [],
			result: {},
		} as any;

		const persisted = await persistSandboxRunArtifact({
			serviceContext: context,
			run,
		});

		expect(put).not.toHaveBeenCalled();
		expect(persisted).toEqual(run);
	});
});
