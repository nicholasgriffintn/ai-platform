import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";
import { MessageFormatter } from "../messages";

describe("MessageFormatter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureAssistantAfterTool", () => {
    it("should insert assistant message after tool message when last two messages are tool then user", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "tool", content: "Tool response", tool_call_id: "call_1" },
        { role: "user", content: "What next?" },
      ];

      const result = MessageFormatter.ensureAssistantAfterTool(messages);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ role: "user", content: "Hello" });
      expect(result[1]).toEqual({
        role: "tool",
        content: "Tool response",
        tool_call_id: "call_1",
      });
      expect(result[2]).toEqual({ role: "assistant", content: "" });
      expect(result[3]).toEqual({ role: "user", content: "What next?" });
    });

    it("should not modify messages when pattern does not match", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "What next?" },
      ];

      const result = MessageFormatter.ensureAssistantAfterTool(messages);

      expect(result).toEqual(messages);
    });

    it("should handle empty messages array", () => {
      const messages: Message[] = [];

      const result = MessageFormatter.ensureAssistantAfterTool(messages);

      expect(result).toEqual([]);
    });

    it("should handle single message", () => {
      const messages: Message[] = [{ role: "user", content: "Hello" }];

      const result = MessageFormatter.ensureAssistantAfterTool(messages);

      expect(result).toEqual(messages);
    });
  });

  describe("formatMessages", () => {
    it("should format messages with default options", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const result = MessageFormatter.formatMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("user");
      expect(result[1].role).toBe("assistant");
    });

    it("should add system prompt when provided", () => {
      const messages: Message[] = [{ role: "user", content: "Hello" }];

      const result = MessageFormatter.formatMessages(messages, {
        system_prompt: "You are a helpful assistant",
        provider: "openai",
      });

      expect(result[0].role).toBe("developer");
      expect(result[0].content).toBe("You are a helpful assistant");
    });

    it("should handle mistral provider with assistant after tool", () => {
      const messages: Message[] = [
        { role: "tool", content: "Tool response", tool_call_id: "call_1" },
        { role: "user", content: "What next?" },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "mistral",
      });

      expect(result).toHaveLength(3);
      expect(result[1].role).toBe("assistant");
    });

    it("should format tool messages for anthropic provider", () => {
      const messages: Message[] = [
        {
          role: "tool",
          content: "Tool response",
          tool_call_id: "call_1",
          name: "test_tool",
          tool_call_arguments: '{"param": "value"}',
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "anthropic",
      });

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("assistant");
      expect(result[0].content).toEqual([
        {
          type: "tool_use",
          id: "call_1",
          name: "test_tool",
          input: { param: "value" },
        },
      ]);
      expect(result[1].role).toBe("user");
      expect(result[1].content).toEqual([
        {
          type: "tool_result",
          tool_use_id: "call_1",
          content: "[Tool Response: test_tool] Tool response ",
        },
      ]);
    });

    it("should format messages for google-ai-studio provider", () => {
      const messages: Message[] = [{ role: "user", content: "Hello world" }];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "google-ai-studio",
      });

      expect(result[0]).toEqual({
        role: "user",
        parts: [{ text: "Hello world" }],
        content: "",
        tool_calls: undefined,
      });
    });

    it("should handle array content for anthropic provider", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,test" },
            },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "anthropic",
      });

      expect(result[0].content).toHaveLength(2);
      expect(result[0].content[0]).toEqual({
        type: "text",
        text: "Hello",
      });
      expect(result[0].content[1]).toEqual({
        type: "image",
        source: {
          type: "url",
          url: "data:image/png;base64,test",
        },
        cache_control: {
          type: "ephemeral",
        },
      });
    });

    it("should handle workers-ai provider with image content", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image" },
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64,testdata" },
            },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "workers-ai",
      });

      expect(result[0].content).toEqual({
        text: "Describe this image",
        image: "testdata",
      });
    });

    it("should filter and format text content for workers-ai provider", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "First text" },
            { type: "text", text: "Second text" },
            // @ts-ignore - unknown type is not typed
            { type: "unknown", data: "ignored" },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "workers-ai",
      });

      expect(result[0].content).toBe("First text\nSecond text");
    });
  });

  describe("tool message formatting", () => {
    it("should format tool message with data field", () => {
      const messages: Message[] = [
        {
          role: "tool",
          content: "Response content",
          tool_call_id: "call_1",
          name: "test_tool",
          data: { key: "value" },
        },
      ];

      const result = MessageFormatter.formatMessages(messages);

      expect(result[0].content).toContain(
        "[Tool Response: test_tool] Response content",
      );
      expect(result[0].content).toContain('Data: {"key":"value"}');
    });

    it("should handle tool message without name", () => {
      const messages: Message[] = [
        {
          role: "tool",
          content: "Response content",
          tool_call_id: "call_1",
        },
      ];

      const result = MessageFormatter.formatMessages(messages);

      expect(result[0].content).toContain(
        "[Tool Response: unknown] Response content",
      );
    });

    it("should handle tool message with malformed data", () => {
      const messages: Message[] = [
        {
          role: "tool",
          content: "Response content",
          tool_call_id: "call_1",
          name: "test_tool",
          data: { circular: {} },
        },
      ];

      (messages[0].data as any).circular.ref = messages[0].data;

      const result = MessageFormatter.formatMessages(messages);

      expect(result[0].content).toContain(
        "[Tool Response: test_tool] Response content",
      );
      expect(result[0].content).not.toContain("Data:");
    });
  });

  describe("content type handling", () => {
    it("should convert single string array to string for anthropic", () => {
      const messages: Message[] = [
        { role: "user", content: ["Single text content"] as any },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "anthropic",
      });

      expect(result[0].content).toBe("Single text content");
    });

    it("should preserve array content when multiple items for anthropic", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "First" },
            { type: "text", text: "Second" },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "anthropic",
      });

      expect(Array.isArray(result[0].content)).toBe(true);
      expect(result[0].content).toHaveLength(2);
    });

    it("should handle bedrock provider content formatting", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,test" },
            },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "bedrock",
      });

      expect(result[0].content).toHaveLength(2);
      expect(result[0].content[0]).toEqual({
        text: "Hello",
      });
      expect(result[0].content[1]).toEqual({
        type: "image_url",
        image_url: { url: "data:image/png;base64,test" },
      });
    });
  });

  describe("markdown_document filtering", () => {
    it("should exclude markdown_document content for anthropic provider", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            {
              type: "markdown_document",
              markdown_document: { markdown: "# Test Document\nContent" },
            },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "anthropic",
      });

      expect(result[0].content).toHaveLength(1);
      expect(result[0].content[0]).toEqual({
        type: "text",
        text: "Hello",
      });
    });

    it("should exclude markdown_document content for google-ai-studio provider", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            {
              type: "markdown_document",
              markdown_document: { markdown: "# Test Document\nContent" },
            },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "google-ai-studio",
      });

      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toEqual({ text: "Hello" });
    });

    it("should exclude markdown_document content for bedrock provider", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            {
              type: "markdown_document",
              markdown_document: { markdown: "# Test Document\nContent" },
            },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "bedrock",
      });

      expect(result[0].content).toHaveLength(1);
      expect(result[0].content[0]).toEqual({ text: "Hello" });
    });

    it("should exclude markdown_document content for default provider", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            {
              type: "markdown_document",
              markdown_document: { markdown: "# Test Document\nContent" },
            },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "unknown-provider",
      });

      expect(result[0].content).toHaveLength(1);
      expect(result[0].content[0]).toEqual({
        type: "text",
        text: "Hello",
      });
    });

    it("should exclude markdown_document for workers-ai provider (already filters to text only)", () => {
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            {
              type: "markdown_document",
              markdown_document: { markdown: "# Test Document\nContent" },
            },
          ],
        },
      ];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "workers-ai",
      });

      expect(result[0].content).toBe("Hello");
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages array", () => {
      const result = MessageFormatter.formatMessages([]);

      expect(result).toEqual([]);
    });

    it("should handle null/undefined content", () => {
      const messages: Message[] = [
        { role: "user", content: null as any },
        { role: "assistant", content: undefined as any },
      ];

      const result = MessageFormatter.formatMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBeNull();
      expect(result[1].content).toBeUndefined();
    });

    it("should handle unknown provider", () => {
      const messages: Message[] = [{ role: "user", content: "Hello" }];

      const result = MessageFormatter.formatMessages(messages, {
        provider: "unknown-provider",
      });

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Hello");
    });
  });
});
