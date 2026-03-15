import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	listRunCoordinatorEvents,
	updateRunCoordinatorControl,
} from "../run-coordinator/client";

function createCoordinatorEnv(fetchImpl: ReturnType<typeof vi.fn>) {
	return {
		SANDBOX_RUN_COORDINATOR: {
			idFromName: vi.fn().mockReturnValue("durable-object-id"),
			get: vi.fn().mockReturnValue({
				fetch: fetchImpl,
			}),
		},
	} as any;
}

describe("run coordinator client", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists run coordinator events using the after cursor", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			Response.json({
				events: [
					{
						index: 2,
						recordedAt: "2026-03-15T12:00:02.000Z",
						event: {
							type: "run_started",
							runId: "run-123",
							timestamp: "2026-03-15T12:00:02.000Z",
						},
					},
				],
			}),
		);
		const env = createCoordinatorEnv(fetchMock);

		const events = await listRunCoordinatorEvents({
			env,
			runId: "run-123",
			after: 1,
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://sandbox-run-coordinator/events?after=1",
			expect.objectContaining({
				method: "GET",
			}),
		);
		expect(events).toHaveLength(1);
		expect(events[0]?.index).toBe(2);
	});

	it("returns an empty events list when coordinator returns non-ok", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response("nope", { status: 500 }));
		const env = createCoordinatorEnv(fetchMock);

		const events = await listRunCoordinatorEvents({
			env,
			runId: "run-123",
		});

		expect(events).toEqual([]);
	});

	it("returns null when control update payload is invalid", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			Response.json({
				state: "invalid",
			}),
		);
		const env = createCoordinatorEnv(fetchMock);

		const result = await updateRunCoordinatorControl({
			env,
			runId: "run-123",
			state: "running",
			updatedAt: "2026-03-15T12:00:00.000Z",
		});

		expect(result).toBeNull();
	});
});
