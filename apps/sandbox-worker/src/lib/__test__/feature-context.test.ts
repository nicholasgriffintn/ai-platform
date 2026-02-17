import { describe, expect, it } from "vitest";

import {
	isImplementInstructionPath,
	isPrdInstructionPath,
	summariseRalphPrdJson,
} from "../feature-implementation/context";

describe("feature-implementation context helpers", () => {
	it("detects PRD instruction paths", () => {
		expect(isPrdInstructionPath("prd.json")).toBe(true);
		expect(isPrdInstructionPath("tasks/prd-001-user-auth.md")).toBe(true);
		expect(isPrdInstructionPath("docs/prd.md")).toBe(true);
		expect(isPrdInstructionPath(".implement")).toBe(false);
	});

	it("detects legacy implement instruction paths", () => {
		expect(isImplementInstructionPath(".implement")).toBe(true);
		expect(isImplementInstructionPath(".implement.md")).toBe(true);
		expect(isImplementInstructionPath("tasks/prd-001-user-auth.md")).toBe(
			false,
		);
	});

	it("summarises Ralph-style PRD JSON with pending stories first", () => {
		const summary = summariseRalphPrdJson(
			JSON.stringify({
				project: "Demo",
				description: "Demo project",
				userStories: [
					{
						id: "US-200",
						title: "Already complete",
						description: "Done",
						priority: 10,
						passes: true,
					},
					{
						id: "US-100",
						title: "Pending",
						description: "Not done",
						priority: 1,
						passes: false,
					},
				],
			}),
		);

		expect(summary).toContain("Ralph PRD summary");
		expect(summary).toContain("Pending user stories");
		expect(summary).toContain("US-100 Pending");
		expect(summary).not.toContain("US-200 Already complete");
	});

	it("returns null for invalid PRD JSON", () => {
		expect(summariseRalphPrdJson("not-json")).toBeNull();
	});
});
