import { describe, expect, it } from "vitest";

import { assertSafeCommand, buildSummary } from "../commands";

describe("assertSafeCommand", () => {
	it("allows non-mutating commands in read-only mode", () => {
		expect(() =>
			assertSafeCommand("pnpm test --filter api", { readOnly: true }),
		).not.toThrow();
	});

	it("blocks mutating commands in read-only mode", () => {
		expect(() => assertSafeCommand("git add -A", { readOnly: true })).toThrow(
			/read-only/,
		);
	});
});

describe("buildSummary", () => {
	it("uses task-type specific summary text", () => {
		const summary = buildSummary(
			"Review authentication flow",
			"owner/repo",
			3,
			undefined,
			"code-review",
		);

		expect(summary).toContain("Completed code review");
	});
});
