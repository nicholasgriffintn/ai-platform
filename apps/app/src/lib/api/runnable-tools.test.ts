import { afterEach, describe, expect, it, vi } from "vitest";

import { executeRunnableTool } from "./runnable-tools";

describe("runnable tools api", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("preserves tool execution metadata", async () => {
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({
				success: true,
				response_id: "response-123",
				data: {
					message: "Successfully executed Research app",
					timestamp: "2026-06-02T09:00:00.000Z",
					input: { query: "contract drift" },
					result: { summary: "ok" },
				},
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await executeRunnableTool(
			"research",
			{ query: "contract drift" },
			"project-123",
		);

		expect(result).toEqual({
			success: true,
			response_id: "response-123",
			data: {
				message: "Successfully executed Research app",
				timestamp: "2026-06-02T09:00:00.000Z",
				input: { query: "contract drift" },
				result: { summary: "ok" },
			},
		});
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/tools/research/execute?projectId=project-123"),
			expect.objectContaining({ method: "POST" }),
		);
	});
});
