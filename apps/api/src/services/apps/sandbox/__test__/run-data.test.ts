import { describe, expect, it } from "vitest";

import {
	appendSandboxRunEvent,
	parseSandboxRunData,
	toSandboxRunResponse,
} from "../run-data";

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

	it("parses optional cancellation metadata", () => {
		const parsed = parseSandboxRunData({
			runId: "run-2",
			installationId: 101,
			repo: "owner/repo",
			task: "Cancel run",
			model: "mistral-large",
			shouldCommit: false,
			status: "cancelled",
			startedAt: "2026-02-17T12:00:00.000Z",
			updatedAt: "2026-02-17T12:00:01.000Z",
			cancelRequestedAt: "2026-02-17T12:00:00.500Z",
			cancellationReason: "Cancelled by user",
		});

		expect(parsed).toMatchObject({
			status: "cancelled",
			cancelRequestedAt: "2026-02-17T12:00:00.500Z",
			cancellationReason: "Cancelled by user",
		});
	});

	it("parses and returns optional prompt strategy metadata", () => {
		const parsed = parseSandboxRunData({
			runId: "run-3",
			installationId: 101,
			repo: "owner/repo",
			task: "Fix flaky tests",
			model: "mistral-large",
			promptStrategy: "bug-fix",
			shouldCommit: false,
			status: "running",
			startedAt: "2026-02-17T12:00:00.000Z",
			updatedAt: "2026-02-17T12:00:01.000Z",
		});

		expect(parsed).toMatchObject({
			promptStrategy: "bug-fix",
		});

		expect(
			toSandboxRunResponse({
				runId: "run-4",
				installationId: 100,
				repo: "owner/repo",
				task: "Refactor duplicate code",
				model: "mistral-large",
				promptStrategy: "refactor",
				shouldCommit: false,
				status: "completed",
				startedAt: "2026-02-17T12:00:00.000Z",
				updatedAt: "2026-02-17T12:00:01.000Z",
			}).promptStrategy,
		).toBe("refactor");
	});

	it("limits appended events to max length", () => {
		const result = appendSandboxRunEvent(
			[{ type: "event-1" }, { type: "event-2" }],
			{ type: "event-3" },
			2,
		);

		expect(result).toEqual([{ type: "event-2" }, { type: "event-3" }]);
	});
});
