import { describe, expect, it } from "vitest";

import { applyMarkdownEdit, extractMarkdownOutline } from "../markdown-editor";

describe("markdown editor utilities", () => {
	it("wraps selected text in bold markers", () => {
		expect(applyMarkdownEdit("Make this stronger", 5, 9, "bold")).toEqual({
			content: "Make **this** stronger",
			selectionStart: 7,
			selectionEnd: 11,
		});
	});

	it("prefixes all selected lines for list formatting", () => {
		expect(applyMarkdownEdit("first\nsecond", 0, 12, "bullet-list")).toEqual({
			content: "- first\n- second",
			selectionStart: 2,
			selectionEnd: 16,
		});
	});

	it("adds a heading marker to the active line", () => {
		expect(applyMarkdownEdit("Intro\nSection title\nBody", 8, 15, "heading")).toEqual({
			content: "Intro\n## Section title\nBody",
			selectionStart: 11,
			selectionEnd: 18,
		});
	});

	it("extracts a document outline from markdown headings", () => {
		expect(extractMarkdownOutline("# Title\n\n## Ask\nBody\n### Details")).toEqual([
			{ level: 1, title: "Title", line: 1 },
			{ level: 2, title: "Ask", line: 3 },
			{ level: 3, title: "Details", line: 5 },
		]);
	});
});
