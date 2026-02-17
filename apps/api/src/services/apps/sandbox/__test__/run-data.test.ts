import { describe, expect, it } from "vitest";

import { parseSandboxRunData, toSandboxRunResponse } from "../run-data";

describe("sandbox run data helpers", () => {
	it("parses valid run payloads", () => {
		const parsed = parseSandboxRunData({
			runId: "run-1",
			installationId: 100,
			repo: "owner/repo",
			task: "Add tests",
			model: "mistral-large",
			shouldCommit: true,
			status: "running",
			startedAt: "2026-02-17T12:00:00.000Z",
			updatedAt: "2026-02-17T12:00:01.000Z",
			events: [{ type: "run_started" }],
			result: { success: true },
		});

		expect(parsed).toMatchObject({
			runId: "run-1",
			status: "running",
			repo: "owner/repo",
		});
	});

	it("rejects invalid run payloads", () => {
		expect(
			parseSandboxRunData({
				runId: "run-1",
				status: "not-a-valid-status",
			}),
		).toBeNull();
	});

	it("normalises response output shape", () => {
		const response = toSandboxRunResponse({
			runId: "run-1",
			installationId: 100,
			repo: "owner/repo",
			task: "Add tests",
			model: "mistral-large",
			shouldCommit: false,
			status: "completed",
			startedAt: "2026-02-17T12:00:00.000Z",
			updatedAt: "2026-02-17T12:00:01.000Z",
		});

		expect(response.events).toEqual([]);
		expect(response.status).toBe("completed");
	});
});
