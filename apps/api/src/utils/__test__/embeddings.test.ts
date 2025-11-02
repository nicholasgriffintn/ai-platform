import { describe, expect, it } from "vitest";

import { chunkText } from "../embeddings";

describe("embeddings", () => {
	describe("chunkText", () => {
		it("should split text into chunks by default max length", () => {
			const longText = "a".repeat(5000);

			const result = chunkText(longText);

			expect(result).toHaveLength(3); // 5000 chars split by default 2000
			expect(result[0]).toHaveLength(2000);
			expect(result[1]).toHaveLength(2000);
			expect(result[2]).toHaveLength(1000);
		});

		it("should split text into chunks by custom max length", () => {
			const text = "Hello world this is a test";
			const maxChars = 10;

			const result = chunkText(text, maxChars);

			expect(result.every((chunk) => chunk.length <= maxChars)).toBe(true);
			expect(result.join("")).toBe(text);
		});

		it("should prefer splitting at newlines", () => {
			const text = "First line\nSecond line that is quite long\nThird line";
			const maxChars = 20;

			const result = chunkText(text, maxChars);

			expect(result.length).toBeGreaterThan(1);
			expect(result.join("")).toBe(text);
			result.forEach((chunk) => {
				expect(chunk.length).toBeLessThanOrEqual(maxChars);
			});
		});

		it("should prefer splitting at spaces when no newlines available", () => {
			const text = "This is a long sentence that should be split at spaces";
			const maxChars = 20;

			const result = chunkText(text, maxChars);

			// Should split at spaces, not in the middle of words
			expect(
				result.every(
					(chunk) =>
						!chunk.includes(" ") ||
						chunk.split(" ").every((word) => word.length <= maxChars),
				),
			).toBe(true);
			expect(result.join("")).toBe(text);
		});

		it("should handle text shorter than max length", () => {
			const text = "Short text";
			const maxChars = 100;

			const result = chunkText(text, maxChars);

			expect(result.join("")).toBe(text);
			expect(result.every((chunk) => chunk.length <= maxChars)).toBe(true);
		});

		it("should handle empty text", () => {
			const text = "";

			const result = chunkText(text);

			expect(result).toEqual([]);
		});

		it("should handle text with only newlines", () => {
			const text = "\n\n\n";
			const maxChars = 2;

			const result = chunkText(text, maxChars);

			expect(result.join("")).toBe(text);
			expect(result.every((chunk) => chunk.length <= maxChars)).toBe(true);
		});

		it("should handle text with only spaces", () => {
			const text = "   ";
			const maxChars = 2;

			const result = chunkText(text, maxChars);

			expect(result.join("")).toBe(text);
			expect(result.every((chunk) => chunk.length <= maxChars)).toBe(true);
		});

		it("should force split when no good split point exists", () => {
			const text = "verylongwordwithoutspacesornewtlinesandshouldbeforcedsplit";
			const maxChars = 20;

			const result = chunkText(text, maxChars);

			expect(result.every((chunk) => chunk.length <= maxChars)).toBe(true);
			expect(result.join("")).toBe(text);
		});

		it("should handle text with mixed separators", () => {
			const text =
				"Line 1\nLine 2 with spaces\nLine 3\n\nDouble newline section";
			const maxChars = 15;

			const result = chunkText(text, maxChars);

			expect(result.join("")).toBe(text);
			expect(result.every((chunk) => chunk.length <= maxChars)).toBe(true);
		});

		it("should handle single character text", () => {
			const text = "a";

			const result = chunkText(text);

			expect(result).toEqual(["a"]);
		});

		it("should handle text exactly at max length", () => {
			const text = "a".repeat(20);
			const maxChars = 20;

			const result = chunkText(text, maxChars);

			expect(result).toEqual([text]);
		});

		it("should handle large text with natural break points", () => {
			const paragraph = "This is a paragraph. ";
			const text = paragraph.repeat(200); // ~4200 characters
			const maxChars = 1000;

			const result = chunkText(text, maxChars);

			expect(result.every((chunk) => chunk.length <= maxChars)).toBe(true);
			expect(result.join("")).toBe(text);
			expect(result.length).toBeGreaterThan(1);
		});
	});
});
