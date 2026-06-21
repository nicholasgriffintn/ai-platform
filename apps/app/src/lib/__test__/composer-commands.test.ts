import { describe, expect, it } from "vitest";

import {
	appendComposerInlineTokenWithCursor,
	findComposerInlineTokenRanges,
	getComposerDirectiveQuery,
	matchesComposerCommand,
	removeComposerDirective,
	replaceComposerDirectiveWithCursor,
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

	it("ignores completed inline mentions when later words are being typed", () => {
		const input = "hey @Daily Weather and";

		expect(getComposerDirectiveQuery(input, input.length)).toBeNull();
	});

	it("ignores directive text that belongs to a rendered inline token", () => {
		const input = "hey @Daily Weather and";

		expect(
			getComposerDirectiveQuery(input, 5, {
				ignoredRanges: [{ start: 4, end: 18 }],
			}),
		).toBeNull();
	});

	it("finds selected inline mention ranges in the current prompt text", () => {
		expect(findComposerInlineTokenRanges("hey @Daily Weather and", "Daily Weather")).toEqual([
			{ start: 4, end: 18 },
		]);
	});

	it("removes the active directive without leaking UI syntax into the prompt", () => {
		const directive = getComposerDirectiveQuery("/sandbox implement this", 8);

		expect(directive && removeComposerDirective("/sandbox implement this", directive)).toBe(
			"implement this",
		);
	});

	it("removes the full directive token when the cursor is inside it", () => {
		const directive = getComposerDirectiveQuery("/sandbox implement this", 4);

		expect(directive).toMatchObject({
			trigger: "/",
			query: "san",
			start: 0,
			end: 8,
		});
		expect(directive && removeComposerDirective("/sandbox implement this", directive)).toBe(
			"implement this",
		);
	});

	it("removes the full mention token when the cursor is inside it", () => {
		const directive = getComposerDirectiveQuery("ask @reviewer to check this", 8);

		expect(directive).toMatchObject({
			trigger: "@",
			query: "rev",
			start: 4,
			end: 13,
		});
		expect(directive && removeComposerDirective("ask @reviewer to check this", directive)).toBe(
			"ask to check this",
		);
	});

	it("replaces directives and reports the next cursor position", () => {
		const directive = getComposerDirectiveQuery("/r", 2);

		expect(
			directive && replaceComposerDirectiveWithCursor("/r", directive, "/run @"),
		).toMatchObject({
			input: "/run @",
			cursorPosition: 6,
			replacementStart: 0,
			replacementEnd: 6,
		});
	});

	it("adds a delimiter after inserted one-word mentions", () => {
		const directive = getComposerDirectiveQuery("@po", 3);

		const selection =
			directive &&
			replaceComposerDirectiveWithCursor("@po", directive, "@PostHog", {
				appendTrailingSpace: true,
			});

		expect(selection).toMatchObject({
			input: "@PostHog ",
			cursorPosition: 9,
			replacementStart: 0,
			replacementEnd: 8,
		});
		expect(
			selection && getComposerDirectiveQuery(selection.input, selection.cursorPosition),
		).toBeNull();
	});

	it("appends inline mentions from compact command selections", () => {
		expect(appendComposerInlineTokenWithCursor("ask", "PostHog")).toEqual({
			input: "ask @PostHog ",
			cursorPosition: 13,
			replacementStart: 4,
			replacementEnd: 12,
		});
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
