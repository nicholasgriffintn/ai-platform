import { describe, expect, it } from "vitest";

import { getProjectCodingPresentation } from "./project-coding-presentation";

describe("getProjectCodingPresentation", () => {
	it("provides coding-specific copy and examples for each task", () => {
		const presentation = getProjectCodingPresentation("bug-fix");

		expect(presentation.title).toBe("What should we fix?");
		expect(presentation.placeholder).toContain("bug");
		expect(presentation.sampleQuestions).toHaveLength(4);
		expect(presentation.sampleQuestions[0]?.category).toBe("coding");
	});
});
