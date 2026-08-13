import { describe, expect, it } from "vitest";

import { withProjectScope } from "./project-scope";

describe("withProjectScope", () => {
	it("adds an encoded project ID without replacing existing parameters", () => {
		expect(withProjectScope("/outputs?limit=10", "project / 1")).toBe(
			"/outputs?limit=10&projectId=project%20%2F%201",
		);
	});
});
