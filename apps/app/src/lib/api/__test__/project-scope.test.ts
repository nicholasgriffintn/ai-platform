import { describe, expect, it } from "vitest";

import { withProjectScope } from "@ngriffin_uk/polychat-library-client/project-scope";

describe("withProjectScope", () => {
	it("adds an encoded project query parameter", () => {
		expect(withProjectScope("/apps/notes", "project / 1")).toBe(
			"/apps/notes?projectId=project%20%2F%201",
		);
	});

	it("preserves existing query parameters", () => {
		expect(withProjectScope("/apps/articles?sources=1", "project-1")).toBe(
			"/apps/articles?sources=1&projectId=project-1",
		);
	});
});
