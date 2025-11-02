import { beforeEach, describe, expect, it } from "vitest";
import { KeywordFilter } from "../keywords";

describe("KeywordFilter", () => {
	let filter: KeywordFilter;

	beforeEach(() => {
		const keywords = [
			"javascript",
			"python",
			"react",
			"algorithm",
			"function",
			"programming",
		];
		filter = new KeywordFilter(keywords);
	});

	describe("constructor", () => {
		it("should create filter with normalized keywords", () => {
			const keywords = ["JavaScript", "  Python  ", "REACT"];
			const testFilter = new KeywordFilter(keywords);

			expect(testFilter.hasKeywords("javascript")).toBe(true);
			expect(testFilter.hasKeywords("python")).toBe(true);
			expect(testFilter.hasKeywords("react")).toBe(true);
		});
	});

	describe("hasKeywords", () => {
		it("should return true when text contains exact keywords", () => {
			const text = "I need help with JavaScript programming";

			expect(filter.hasKeywords(text)).toBe(true);
		});

		it("should return true when text contains multiple keywords", () => {
			const text = "How to use React with Python backend";

			expect(filter.hasKeywords(text)).toBe(true);
		});

		it("should return false when text contains no keywords", () => {
			const text = "I love cooking and gardening";

			expect(filter.hasKeywords(text)).toBe(false);
		});

		it("should handle case insensitive matching", () => {
			const text = "JAVASCRIPT and PYTHON are great languages";

			expect(filter.hasKeywords(text)).toBe(true);
		});

		it("should filter out short words", () => {
			const text = "I am a to go";

			expect(filter.hasKeywords(text)).toBe(false);
		});
	});

	describe("getMatchedKeywords", () => {
		it("should return matched keywords", () => {
			const text = "I want to learn JavaScript and Python programming";

			const matches = filter.getMatchedKeywords(text);

			expect(matches).toContain("javascript");
			expect(matches).toContain("python");
			expect(matches).toContain("programming");
		});

		it("should return empty array when no matches", () => {
			const text = "I love cooking and gardening";

			const matches = filter.getMatchedKeywords(text);

			expect(matches).toEqual([]);
		});
	});

	describe("getCategorizedMatches", () => {
		it("should categorize matched keywords", () => {
			const codingFilter = new KeywordFilter(
				KeywordFilter.getAllCodingKeywords(),
			);
			const text =
				"I need help with JavaScript algorithms and Python functions";

			const categorized = codingFilter.getCategorizedMatches(text);

			expect(Object.keys(categorized).length).toBeGreaterThan(0);
		});

		it("should return empty object when no matches", () => {
			const text = "I love cooking and gardening";

			const categorized = filter.getCategorizedMatches(text);

			expect(categorized).toEqual({});
		});
	});

	describe("static keyword getters", () => {
		it("should return all coding keywords", () => {
			const keywords = KeywordFilter.getAllCodingKeywords();

			expect(keywords).toContain("python");
			expect(keywords).toContain("javascript");
			expect(keywords).toContain("react");
			expect(keywords).toContain("algorithm");
			expect(keywords.length).toBeGreaterThan(50);
		});

		it("should return all math keywords", () => {
			const keywords = KeywordFilter.getAllMathKeywords();

			expect(keywords).toContain("calculate");
			expect(keywords).toContain("algebra");
			expect(keywords).toContain("calculus");
			expect(keywords).toContain("equation");
			expect(keywords.length).toBeGreaterThan(20);
		});

		it("should return all general keywords", () => {
			const keywords = KeywordFilter.getAllGeneralKeywords();

			expect(keywords).toContain("explain");
			expect(keywords).toContain("describe");
			expect(keywords).toContain("what");
			expect(keywords).toContain("why");
		});

		it("should return all creative keywords", () => {
			const keywords = KeywordFilter.getAllCreativeKeywords();

			expect(keywords).toContain("create");
			expect(keywords).toContain("design");
			expect(keywords).toContain("write");
			expect(keywords).toContain("story");
		});

		it("should return all reasoning keywords", () => {
			const keywords = KeywordFilter.getAllReasoningKeywords();

			expect(keywords).toContain("analyze");
			expect(keywords).toContain("evaluate");
			expect(keywords).toContain("compare");
			expect(keywords).toContain("debate");
		});
	});

	describe("partial matching", () => {
		it("should match similar words with high similarity", () => {
			const filter = new KeywordFilter(["javascript"]);

			expect(filter.hasKeywords("javascrip")).toBe(true);
		});

		it("should not match words with low similarity", () => {
			const filter = new KeywordFilter(["programming"]);

			expect(filter.hasKeywords("cat")).toBe(false);
		});

		it("should match partial words within threshold", () => {
			const filter = new KeywordFilter(["javascript"]);

			expect(filter.hasKeywords("javascrip")).toBe(true);
		});
	});

	describe("text tokenization", () => {
		it("should handle punctuation and special characters", () => {
			const text = "JavaScript, Python, and React!";

			expect(filter.hasKeywords(text)).toBe(true);
		});

		it("should handle multiple spaces and line breaks", () => {
			const text = "JavaScript\n\n  Python    React";

			expect(filter.hasKeywords(text)).toBe(true);
		});
	});

	describe("edge cases", () => {
		it("should handle empty text", () => {
			expect(filter.hasKeywords("")).toBe(false);
			expect(filter.getMatchedKeywords("")).toEqual([]);
		});

		it("should handle text with only short words", () => {
			const text = "I am a to go on it";

			expect(filter.hasKeywords(text)).toBe(false);
		});

		it("should handle empty keyword list", () => {
			const emptyFilter = new KeywordFilter([]);

			expect(emptyFilter.hasKeywords("javascript python")).toBe(false);
		});
	});
});
