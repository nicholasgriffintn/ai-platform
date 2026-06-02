import { afterEach, describe, expect, it, vi } from "vitest";

import { executeDynamicApp } from "./dynamic-apps";

describe("dynamic-apps api", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("preserves dynamic app execution metadata", async () => {
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

		const result = await executeDynamicApp("research", { query: "contract drift" });

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
	});
});
