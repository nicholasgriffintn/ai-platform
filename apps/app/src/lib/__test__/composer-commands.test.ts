import { describe, expect, it } from "vitest";

import {
	getComposerDirectiveQuery,
	matchesComposerCommand,
	removeComposerDirective,
} from "../composer-commands";

describe("composer command parsing", () => {
	it("detects slash commands at the active cursor token", () => {
		expect(getComposerDirectiveQuery("/sandbox implement this", 8)).toEqual({
			trigger: "/",
			query: "sandbox",
			start: 0,
			end: 8,
		});
	});

	it("detects agent mentions after whitespace", () => {
		expect(getComposerDirectiveQuery("ask @review", 11)).toEqual({
			trigger: "@",
			query: "review",
			start: 4,
			end: 11,
		});
	});

	it("ignores completed tokens away from the cursor", () => {
		expect(getComposerDirectiveQuery("/sandbox do work", 16)).toBeNull();
	});

	it("removes the active directive without leaking UI syntax into the prompt", () => {
		const directive = getComposerDirectiveQuery("/sandbox implement this", 8);

		expect(directive && removeComposerDirective("/sandbox implement this", directive)).toBe(
			"implement this",
		);
	});

	it("matches commands by label, command, or description", () => {
		expect(matchesComposerCommand("sand", ["Sandbox", "sandbox", "Run repository tasks"])).toBe(
			true,
		);
		expect(matchesComposerCommand("team", ["Sandbox", "sandbox", "Run repository tasks"])).toBe(
			false,
		);
	});
});
