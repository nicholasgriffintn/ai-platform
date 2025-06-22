import { describe, expect, it } from "vitest";

import { trimTemplateWhitespace } from "../strings";

describe("strings", () => {
  describe("trimTemplateWhitespace", () => {
    it("should replace multiple spaces with single space", () => {
      const input = "Hello    world  test";
      const expected = "Hello world test";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });

    it("should replace multiple tabs with single space", () => {
      const input = "Hello\t\t\tworld\t\ttest";
      const expected = "Hello world test";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });

    it("should replace mixed spaces and tabs with single space", () => {
      const input = "Hello \t \t world";
      const expected = "Hello world";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });

    it("should remove spaces at the start of each line", () => {
      const input = "  Hello\n    world\n      test";
      const expected = "Hello\nworld\ntest";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });

    it("should remove tabs at the start of each line", () => {
      const input = "\t\tHello\n\t\t\tworld\n\ttest";
      const expected = "Hello\nworld\ntest";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });

    it("should replace multiple consecutive empty lines with double newline", () => {
      const input = "Hello\n\n\n\nworld\n\n\n\n\ntest";
      const expected = "Hello\n\nworld\n\ntest";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });

    it("should handle complex template literal formatting", () => {
      const input = `
        function example() {
          const message = "Hello    world";
          
          
          
          return message;
        }
      `;
      const result = trimTemplateWhitespace(input);

      expect(result).toContain("function example() {");
      expect(result).toContain('const message = "Hello world";');
      expect(result).toContain("return message;");
      expect(result).toContain("}");
      expect(result.match(/\n{3,}/)).toBeNull();
    });

    it("should preserve single newlines", () => {
      const input = "Line 1\nLine 2\nLine 3";
      const expected = "Line 1\nLine 2\nLine 3";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });

    it("should preserve double newlines", () => {
      const input = "Paragraph 1\n\nParagraph 2";
      const expected = "Paragraph 1\n\nParagraph 2";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });

    it("should handle empty string", () => {
      expect(trimTemplateWhitespace("")).toBe("");
    });

    it("should handle string with only whitespace", () => {
      const input = "   \t  \n  \t  ";
      const expected = "\n";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });

    it("should handle string with no whitespace issues", () => {
      const input = "clean text";
      const expected = "clean text";
      expect(trimTemplateWhitespace(input)).toBe(expected);
    });
  });
});
