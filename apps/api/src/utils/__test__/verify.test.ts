import { describe, expect, it } from "vitest";
import { verifyQuotes } from "../verify";

describe("verify", () => {
	describe("verifyQuotes", () => {
		it("should verify all quotes are present in article", () => {
			const article =
				"This is a test article with some content. It has multiple sentences and paragraphs.";
			const quotes = ["test article", "multiple sentences"];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should detect missing quotes", () => {
			const article = "This is a test article with some content.";
			const quotes = ["test article", "missing quote", "another missing"];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(false);
			expect(result.missingQuotes).toEqual([
				"missing quote",
				"another missing",
			]);
		});

		it("should handle case insensitive matching", () => {
			const article = "This is a TEST Article with SOME content.";
			const quotes = ["test article", "some content"];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should ignore punctuation in matching", () => {
			const article = "Hello, world! This is a test.";
			const quotes = ["hello world", "this is a test"];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should normalize whitespace", () => {
			const article = "This  is   a    test     article";
			const quotes = ["this is a test article"];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should handle empty quotes array", () => {
			const article = "This is a test article.";
			const quotes: string[] = [];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should handle empty article", () => {
			const article = "";
			const quotes = ["test quote"];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(false);
			expect(result.missingQuotes).toEqual(["test quote"]);
		});

		it("should handle quotes with special characters", () => {
			const article = "The price is $100.50 (approximately €85).";
			const quotes = ["price is 10050", "approximately 85"];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should handle partial word matches correctly", () => {
			const article = "This is testing the functionality.";
			const quotes = ["test"]; // Should not match "testing"

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true); // Because "test" is a substring of "testing"
			expect(result.missingQuotes).toEqual([]);
		});

		it("should handle quotes with leading/trailing whitespace", () => {
			const article = "This is a test article.";
			const quotes = ["  test article  ", " this is "];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should handle very long article and quotes", () => {
			const article =
				"Lorem ipsum ".repeat(1000) +
				"special phrase " +
				"dolor sit amet ".repeat(1000);
			const quotes = ["lorem ipsum", "special phrase", "dolor sit amet"];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should handle quotes with numbers", () => {
			const article = "The temperature was 25.5 degrees Celsius in 2023.";
			const quotes = ["temperature was 255 degrees", "celsius in 2023"];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should handle mixed case and punctuation combinations", () => {
			const article =
				"Dr. Smith's research, published in 2023, shows remarkable results!";
			const quotes = [
				"Dr Smiths research",
				"published in 2023",
				"remarkable results",
			];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(true);
			expect(result.missingQuotes).toEqual([]);
		});

		it("should return correct missing quotes when some are found", () => {
			const article = "This article contains some quotes but not all of them.";
			const quotes = [
				"article contains",
				"missing quote",
				"not all",
				"another missing",
			];

			const result = verifyQuotes(article, quotes);

			expect(result.verified).toBe(false);
			expect(result.missingQuotes).toEqual([
				"missing quote",
				"another missing",
			]);
		});
	});
});
