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

	it("blocks shell redirection in read-only mode", () => {
		expect(() =>
			assertSafeCommand("echo hi > /tmp/test.txt", { readOnly: true }),
		).toThrow(/read-only/);
	});

	it("blocks interpreter commands in read-only mode", () => {
		expect(() =>
			assertSafeCommand("python -c \"open('tmp.txt','w').write('x')\"", {
				readOnly: true,
			}),
		).toThrow(/not allowed|read-only/);
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

	it("includes refactoring summary variants", () => {
		const summary = buildSummary(
			"Cleanup duplicated parsing",
			"owner/repo",
			4,
			"sandbox/refactor-branch",
			"refactoring",
		);

		expect(summary).toContain("Completed refactoring");
		expect(summary).toContain("sandbox/refactor-branch");
	});
});
