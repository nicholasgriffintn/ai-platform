import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkContextWindowLimits,
	dedupeAttachments,
	enforceAttachmentLimits,
	getAllAttachments,
	parseAttachments,
	pruneMessagesToFitContext,
	sanitiseInput,
	sanitiseMessages,
} from "../utils";

vi.mock("~/utils/errors", () => ({
	AssistantError: class extends Error {
		type: string;
		constructor(message: string, type?: string) {
			super(message);
			this.type = type || "UNKNOWN";
			this.name = "AssistantError";
		}
	},
	ErrorType: {
		CONTEXT_WINDOW_EXCEEDED: "CONTEXT_WINDOW_EXCEEDED",
		PARAMS_ERROR: "PARAMS_ERROR",
	},
}));

describe("chat utils", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
	});

	describe("checkContextWindowLimits", () => {
		const mockModelConfig = { contextWindow: 1000 };
		const messages = [
			{ content: "Hello", role: "user" },
			{ content: "Hi there", role: "assistant" },
		];

		it("should pass when content is within limits", () => {
			expect(() =>
				// @ts-expect-error - test data
				checkContextWindowLimits(messages, "Short message", mockModelConfig),
			).not.toThrow();
		});

		it("should throw error when content exceeds context window", () => {
			const longMessage = "a".repeat(4000); // ~1000 tokens

			expect(() =>
				// @ts-expect-error - test data
				checkContextWindowLimits(messages, longMessage, mockModelConfig),
			).toThrow("Content exceeds model context window");
		});

		it("should use default context window when not provided", () => {
			const longMessage = "a".repeat(32000); // ~8000 tokens (default limit)

			// @ts-expect-error - test data
			expect(() => checkContextWindowLimits(messages, longMessage, {})).toThrow(
				"Content exceeds model context window",
			);
		});

		it("should handle complex message content", () => {
			const complexMessages = [
				{
					content: [{ type: "text", text: "Hello" }],
					role: "user",
				},
			];

			expect(() =>
				// @ts-expect-error - test data
				checkContextWindowLimits(complexMessages, "Test", mockModelConfig),
			).not.toThrow();
		});
	});

	describe("parseAttachments", () => {
		it("should parse image attachments", () => {
			const contents = [
				{
					type: "image_url",
					image_url: { url: "https://example.com/image.jpg", detail: "high" },
				},
			];

			const result = parseAttachments(contents);

			expect(result.imageAttachments).toEqual([
				{
					type: "image",
					url: "https://example.com/image.jpg",
					detail: "high",
				},
			]);
			expect(result.documentAttachments).toEqual([]);
			expect(result.markdownAttachments).toEqual([]);
		});

		it("should parse document attachments", () => {
			const contents = [
				{
					type: "document_url",
					document_url: {
						url: "https://example.com/doc.pdf",
						name: "Document",
					},
				},
			];

			const result = parseAttachments(contents);

			expect(result.documentAttachments).toEqual([
				{
					type: "document",
					url: "https://example.com/doc.pdf",
					name: "Document",
				},
			]);
		});

		it("should parse markdown attachments", () => {
			const contents = [
				{
					type: "markdown_document",
					markdown_document: { markdown: "# Title", name: "README" },
				},
			];

			const result = parseAttachments(contents);

			expect(result.markdownAttachments).toEqual([
				{
					type: "markdown_document",
					markdown: "# Title",
					name: "README",
				},
			]);
		});

		it("should handle auto detail for images", () => {
			const contents = [
				{
					type: "image_url",
					image_url: { url: "https://example.com/image.jpg", detail: "auto" },
				},
			];

			const result = parseAttachments(contents);

			expect(result.imageAttachments[0].detail).toBeUndefined();
		});

		it("should filter out invalid attachments", () => {
			const contents = [
				{ type: "invalid", data: "test" },
				{ type: "image_url" }, // missing image_url
				{ type: "document_url", document_url: null },
			];

			const result = parseAttachments(contents);

			expect(result.imageAttachments).toEqual([]);
			expect(result.documentAttachments).toEqual([]);
			expect(result.markdownAttachments).toEqual([]);
		});
	});

	describe("dedupeAttachments", () => {
		it("should remove duplicate URL attachments", () => {
			const attachments = [
				{ type: "image", url: "https://example.com/1.jpg" },
				{ type: "image", url: "https://example.com/2.jpg" },
				{ type: "image", url: "https://example.com/1.jpg" }, // duplicate
			];

			const result = dedupeAttachments(attachments as any);

			expect(result).toHaveLength(2);
			expect(result[0].url).toBe("https://example.com/1.jpg");
			expect(result[1].url).toBe("https://example.com/2.jpg");
		});

		it("should remove duplicate markdown attachments", () => {
			const attachments = [
				{ type: "markdown_document", markdown: "# Title 1" },
				{ type: "markdown_document", markdown: "# Title 2" },
				{ type: "markdown_document", markdown: "# Title 1" }, // duplicate
			];

			const result = dedupeAttachments(attachments as any);

			expect(result).toHaveLength(2);
		});

		it("should filter out attachments without url or markdown", () => {
			const attachments = [
				{ type: "other", data: "test1" },
				{ type: "other", data: "test2" },
			];

			const result = dedupeAttachments(attachments as any);

			expect(result).toHaveLength(0);
		});

		it("should filter out attachments with empty keys", () => {
			const attachments = [
				{ type: "image", url: "" },
				{ type: "markdown_document", markdown: "" },
				{ type: "image", url: "https://example.com/image.jpg" },
				{ type: "markdown_document", markdown: "" }, // another empty one
			];

			const result = dedupeAttachments(attachments as any);

			expect(result).toHaveLength(1);
			expect(result[0].url).toBe("https://example.com/image.jpg");
		});
	});

	describe("enforceAttachmentLimits", () => {
		it("should pass when within limits", () => {
			const attachments = [
				{ type: "image", url: "https://example.com/1.jpg" },
				{ type: "image", url: "https://example.com/2.jpg" },
			];

			expect(() =>
				enforceAttachmentLimits(attachments as any, 10, 1000),
			).not.toThrow();
		});

		it("should throw error when too many attachments", () => {
			const attachments = Array(15).fill({ type: "image", url: "test.jpg" });

			expect(() => enforceAttachmentLimits(attachments as any, 10)).toThrow(
				"Too many attachments (15), limit is 10",
			);
		});

		it("should throw error when total size exceeds limit", () => {
			const attachments = [
				{
					type: "markdown_document",
					markdown: "a".repeat(600000), // 600KB
					name: "large.md",
				},
				{
					type: "markdown_document",
					markdown: "b".repeat(600000), // 600KB
				},
			];

			expect(() =>
				enforceAttachmentLimits(attachments as any, 10, 1024 * 1024),
			).toThrow("Attachments size too large");
		});

		it("should use default limits", () => {
			const attachments = Array(15).fill({ type: "image", url: "test.jpg" });

			expect(() => enforceAttachmentLimits(attachments as any)).toThrow(
				"Too many attachments (15), limit is 10",
			);
		});
	});

	describe("getAllAttachments", () => {
		it("should process all attachment types", () => {
			const contents = [
				{
					type: "image_url",
					image_url: { url: "https://example.com/image.jpg" },
				},
				{
					type: "document_url",
					document_url: { url: "https://example.com/doc.pdf" },
				},
				{
					type: "markdown_document",
					markdown_document: { markdown: "# Title" },
				},
			];

			const result = getAllAttachments(contents);

			expect(result.imageAttachments).toHaveLength(1);
			expect(result.documentAttachments).toHaveLength(1);
			expect(result.markdownAttachments).toHaveLength(1);
			expect(result.allAttachments).toHaveLength(3);
		});

		it("should dedupe attachments", () => {
			const contents = [
				{
					type: "image_url",
					image_url: { url: "https://example.com/image.jpg" },
				},
				{
					type: "image_url",
					image_url: { url: "https://example.com/image.jpg" }, // duplicate
				},
			];

			const result = getAllAttachments(contents);

			expect(result.imageAttachments).toHaveLength(1);
			expect(result.allAttachments).toHaveLength(1);
		});

		it("should enforce limits and throw on violation", () => {
			const contents = Array.from({ length: 15 }, (_, i) => ({
				type: "image_url",
				image_url: { url: `https://example.com/image${i}.jpg` },
			}));

			expect(() => getAllAttachments(contents)).toThrow("Too many attachments");
		});
	});

	describe("pruneMessagesToFitContext", () => {
		const mockModelConfig = { contextWindow: 100 }; // Very small for testing
		const messages = [
			{ content: "Message 1", role: "user" },
			{ content: "Message 2", role: "assistant" },
			{ content: "Message 3", role: "user" },
		];

		it("should return all messages when within limits", () => {
			// @ts-expect-error - test data
			const result = pruneMessagesToFitContext(messages, "Short", {
				contextWindow: 1000,
			});

			expect(result).toHaveLength(3);
			expect(result).toEqual(messages);
		});

		it("should remove messages to fit context", () => {
			const longNewContent = "a".repeat(400); // ~100 tokens

			const result = pruneMessagesToFitContext(
				// @ts-expect-error - test data
				messages,
				longNewContent,
				mockModelConfig,
			);

			expect(result.length).toBeLessThan(messages.length);
		});

		it("should use default context window", () => {
			// @ts-expect-error - test data
			const result = pruneMessagesToFitContext(messages, "Test", {});

			expect(result).toEqual(messages);
		});

		it("should handle complex message content", () => {
			const complexMessages = [
				{
					content: [{ type: "text", text: "Complex message" }],
					role: "user",
				},
			];

			const result = pruneMessagesToFitContext(
				// @ts-expect-error - test data
				complexMessages,
				"Test",
				mockModelConfig,
			);

			expect(result).toEqual(complexMessages);
		});

		it("should return empty array if all messages need to be removed", () => {
			const veryLongContent = "a".repeat(1000); // Exceeds context window

			const result = pruneMessagesToFitContext(
				// @ts-expect-error - test data
				messages,
				veryLongContent,
				mockModelConfig,
			);

			expect(result).toEqual([]);
		});
	});

	describe("sanitiseInput", () => {
		it("should remove instruction formats", () => {
			const input =
				"<INST>Do something</INST> and <system>system prompt</system>";
			const result = sanitiseInput(input);

			expect(result).toBe("Do something and system prompt");
		});

		it("should remove square bracket instructions", () => {
			const input = "[INST]Instruction[/INST] and [system]system[/system]";
			const result = sanitiseInput(input);

			expect(result).toBe("Instruction and system");
		});

		it("should remove sentinel tokens", () => {
			const input = "<s>Start token</s> content";
			const result = sanitiseInput(input);

			expect(result).toBe("Start token content");
		});

		it("should escape template syntax", () => {
			const input = "Use {{variable}} in template";
			const result = sanitiseInput(input);

			expect(result).toBe("Use { {variable} } in template");
		});

		it("should handle XML-style tags", () => {
			const input = "Use <tag attr='value'>content</tag>";
			const result = sanitiseInput(input);

			expect(result).toBe("Use `&lt;tag attr='value'&gt;`content</tag>");
		});

		it("should preserve code blocks", () => {
			const input =
				"Here is code:\n```javascript\nconst x = {{test}};\n```\nDone";
			const result = sanitiseInput(input);

			expect(result).toContain("```javascript\nconst x = {{test}};\n```");
			expect(result).not.toContain("{ {test} }");
		});

		it("should normalize whitespace but preserve newlines", () => {
			const input = "Multiple    spaces\t\tand\ttabs\nbut\nnewlines\nstay";
			const result = sanitiseInput(input);

			expect(result).toBe("Multiple spaces and tabs\nbut\nnewlines\nstay");
		});

		it("should handle empty input", () => {
			const result = sanitiseInput("");
			expect(result).toBe("");
		});

		it("should handle multiple code blocks", () => {
			const input = "```js\ncode1\n``` text ```py\ncode2\n``` more";
			const result = sanitiseInput(input);

			expect(result).toContain("```js\ncode1\n```");
			expect(result).toContain("```py\ncode2\n```");
		});
	});

	describe("sanitiseMessages", () => {
		it("should sanitise user messages with string content", () => {
			const messages = [
				{
					role: "user",
					content: "<INST>Do something</INST>",
				},
				{
					role: "assistant",
					content: "<INST>Should not be sanitised</INST>",
				},
			];

			// @ts-expect-error - test data
			const result = sanitiseMessages(messages);

			expect(result[0].content).toBe("Do something");
			expect(result[1].content).toBe("<INST>Should not be sanitised</INST>");
		});

		it("should sanitise developer messages", () => {
			const messages = [
				{
					role: "developer",
					content: "{{template}} syntax",
				},
			];

			// @ts-expect-error - test data
			const result = sanitiseMessages(messages);

			expect(result[0].content).toBe("{ {template} } syntax");
		});

		it("should sanitise array content messages", () => {
			const messages = [
				{
					role: "user",
					content: [
						{ type: "text", text: "<INST>Clean this</INST>" },
						{ type: "image", url: "test.jpg" },
					],
				},
			];

			// @ts-expect-error - test data
			const result = sanitiseMessages(messages);

			// @ts-expect-error - test data
			expect(result[0].content[0].text).toBe("Clean this");
			expect(result[0].content[1]).toEqual({ type: "image", url: "test.jpg" });
		});

		it("should handle non-text content in arrays", () => {
			const messages = [
				{
					role: "user",
					content: [
						{ type: "image", url: "test.jpg" },
						{ type: "other", data: "test" },
					],
				},
			];

			// @ts-expect-error - test data
			const result = sanitiseMessages(messages);

			expect(result[0].content).toEqual([
				{ type: "image", url: "test.jpg" },
				{ type: "other", data: "test" },
			]);
		});

		it("should not sanitise assistant messages", () => {
			const messages = [
				{
					role: "assistant",
					content: "<INST>Keep as is</INST>",
				},
			];

			// @ts-expect-error - test data
			const result = sanitiseMessages(messages);

			expect(result[0].content).toBe("<INST>Keep as is</INST>");
		});

		it("should handle empty messages array", () => {
			const result = sanitiseMessages([]);
			expect(result).toEqual([]);
		});
	});
});
