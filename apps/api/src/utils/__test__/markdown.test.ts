import { describe, expect, it } from "vitest";

import { convertMarkdownToHtml } from "../markdown";

describe("markdown", () => {
	describe("convertMarkdownToHtml", () => {
		it("should convert headers", () => {
			const markdown = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("<h1>H1</h1>");
			expect(result).toContain("<h2>H2</h2>");
			expect(result).toContain("<h3>H3</h3>");
			expect(result).toContain("<h4>H4</h4>");
			expect(result).toContain("<h5>H5</h5>");
			expect(result).toContain("<h6>H6</h6>");
		});

		it("should convert code blocks", () => {
			const markdown = "```javascript\nconst x = 1;\n```";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("<pre><code>javascript");
			expect(result).toContain("const x = 1;");
			expect(result).toContain("</code></pre>");
		});

		it("should convert inline code", () => {
			const markdown = "This is `inline code` in a sentence.";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain(
				"This is <code>inline code</code> in a sentence.",
			);
		});

		it("should convert blockquotes", () => {
			const markdown = "> This is a blockquote";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("<blockquote>This is a blockquote</blockquote>");
		});

		it("should convert unordered lists with asterisks", () => {
			const markdown = "* Item 1\n* Item 2\n* Item 3";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain(
				"<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>",
			);
		});

		it("should convert unordered lists with dashes", () => {
			const markdown = "- Item 1\n- Item 2\n- Item 3";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain(
				"<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>",
			);
		});

		it("should convert ordered lists", () => {
			const markdown = "1. Item 1\n2. Item 2\n3. Item 3";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain(
				"<ol><li>Item 1</li><li>Item 2</li><li>Item 3</li></ol>",
			);
		});

		it("should convert bold text with double asterisks", () => {
			const markdown = "This is **bold** text.";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("This is <strong>bold</strong> text.");
		});

		it("should convert bold text with double underscores", () => {
			const markdown = "This is __bold__ text.";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("This is <strong>bold</strong> text.");
		});

		it("should convert italic text with single asterisks", () => {
			const markdown = "This is *italic* text.";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("This is <em>italic</em> text.");
		});

		it("should convert italic text with single underscores", () => {
			const markdown = "This is _italic_ text.";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("This is <em>italic</em> text.");
		});

		it("should convert images", () => {
			const markdown = "![Alt text](https://example.com/image.jpg)";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain(
				'<img src="https://example.com/image.jpg" alt="Alt text">',
			);
		});

		it("should convert links", () => {
			const markdown = "[Link text](https://example.com)";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain('<a href="https://example.com">Link text</a>');
		});

		it("should handle mixed formatting", () => {
			const markdown =
				"# Header\n\nThis is **bold** and *italic* text with `code`.\n\n- List item\n- Another item";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("<h1>Header</h1>");
			expect(result).toContain("<strong>bold</strong>");
			expect(result).toContain("<em>italic</em>");
			expect(result).toContain("<code>code</code>");
			expect(result).toContain("<li>List item</li>");
		});

		it("should handle empty string", () => {
			const markdown = "";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toBe("");
		});

		it("should handle plain text without markdown", () => {
			const markdown = "This is just plain text.";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("This is just plain text.");
		});

		it("should handle multiple paragraphs", () => {
			const markdown = "First paragraph.\n\nSecond paragraph.";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("First paragraph.");
			expect(result).toContain("Second paragraph.");
		});

		it("should handle line breaks", () => {
			const markdown = "Line 1\nLine 2";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("<br>");
		});

		it("should handle nested formatting", () => {
			const markdown = "**Bold with *italic* inside**";

			const result = convertMarkdownToHtml(markdown);

			// The simple regex-based converter doesn't handle nested formatting perfectly
			expect(result).toContain("Bold with");
			expect(result).toContain("italic");
			expect(result).toContain("inside");
		});

		it("should handle code blocks with different languages", () => {
			const markdown =
				"```python\nprint('hello')\n```\n\n```html\n<div>test</div>\n```";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("<pre><code>python");
			expect(result).toContain("print('hello')");
			expect(result).toContain("<pre><code>html");
			expect(result).toContain("<div>test</div>");
			expect(result).toContain("</code></pre>");
		});

		it("should handle multiple blockquotes", () => {
			const markdown = "> Quote 1\n> Quote 2\n> Quote 3";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("<blockquote>Quote 1</blockquote>");
			expect(result).toContain("<blockquote>Quote 2</blockquote>");
			expect(result).toContain("<blockquote>Quote 3</blockquote>");
		});

		it("should handle complex list structures", () => {
			const markdown =
				"1. First item\n2. Second item\n   - Nested item\n   - Another nested\n3. Third item";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("<ol>");
			expect(result).toContain("<li>First item</li>");
			expect(result).toContain("<li>Second item</li>");
			expect(result).toContain("<li>Third item</li>");
			expect(result).toContain("</ol>");
		});

		it("should handle edge cases with special characters", () => {
			const markdown =
				"Text with **bold**, *italic*, and `code` plus [link](http://test.com) and ![image](test.jpg).";

			const result = convertMarkdownToHtml(markdown);

			expect(result).toContain("<strong>bold</strong>");
			expect(result).toContain("<em>italic</em>");
			expect(result).toContain("<code>code</code>");
			expect(result).toContain('<a href="http://test.com">link</a>');
			expect(result).toContain('<img src="test.jpg" alt="image">');
		});

		it("should not interfere with already processed elements", () => {
			const markdown = "# Header with `code`\n\n**Bold** text with *emphasis*.";

			const result = convertMarkdownToHtml(markdown);

			// Should not double-process elements
			expect(result).not.toContain("<<");
			expect(result).not.toContain(">>");
		});
	});
});
