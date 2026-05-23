import { describe, expect, it } from "vitest";

import { renderCustomView } from "./registry";

describe("custom response view registry", () => {
	it("returns registered views by tool name", () => {
		expect(
			renderCustomView("sandbox_result", {
				data: {
					runId: "run-1",
					status: "completed",
					summary: "Done",
				},
				embedded: false,
			}),
		).toBeTruthy();
	});

	it("falls back for unknown custom views", () => {
		expect(
			renderCustomView("unknown_tool", {
				data: {},
				embedded: false,
			}),
		).toBeNull();
	});
});
