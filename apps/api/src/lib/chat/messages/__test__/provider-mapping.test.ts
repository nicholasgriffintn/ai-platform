import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import { compactJsonWhitespace } from "~/utils/json";

import { buildMessageParts } from "../parts";
import {
  isProviderMessage,
  toProviderMessages,
  toProviderResponseMessagePartSource,
  toProviderResponseMessages,
} from "../provider-mapping";
import { compactToolOutput } from "../tool-output-compaction";

describe("isProviderMessage", () => {
  it("excludes compaction status messages represented by role or parts", () => {
    const messages = [
      { role: "user", content: "Hello" },
      {
        role: "compaction",
        content: "Context compacted",
        parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
      },
      {
        role: "assistant",
        content: "Context compacted",
        parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
      },
      { role: "assistant", content: "Hi" },
    ];

    expect(messages.filter(isProviderMessage)).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ]);
  });

  it("projects nullable message lists into provider-eligible messages", () => {
    const messages = [
      { role: "user", content: "Hello" },
      {
        role: "compaction",
        content: "Context compacted",
        parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
      },
      { role: "assistant", content: "Hi" },
    ];

    expect(toProviderMessages(messages)).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ]);
    expect(toProviderMessages(undefined)).toEqual([]);
    expect(toProviderMessages(null)).toEqual([]);
  });

  it("excludes malformed assistant-shaped compaction metadata from provider context", () => {
    const messages = [
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: "Context compacted",
        parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
      },
      { role: "assistant", content: "Hi" },
    ];

    expect(toProviderMessages(messages)).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ]);
  });

  it("keeps instruction roles eligible for provider context", () => {
    const messages = [
      { role: "system", content: "System instructions" },
      { role: "developer", content: "Developer instructions" },
      { role: "user", content: "Hello" },
    ];

    expect(toProviderMessages(messages).map((message) => message.role)).toEqual([
      "system",
      "developer",
      "user",
    ]);
  });

  it("keeps assistant tool-call turns without content eligible for provider context", () => {
    const toolCallMessage = {
      role: "assistant",
      tool_calls: [
        {
          id: "call-weather",
          type: "function",
          function: {
            name: "get_weather",
            arguments: "{}",
          },
        },
      ],
    };

    expect(isProviderMessage(toolCallMessage)).toBe(true);
    expect(toProviderMessages([toolCallMessage])).toEqual([{ ...toolCallMessage, content: "" }]);
  });

  it("keeps provider context timestamps numeric but preserves response timestamps", () => {
    const toolMessage = {
      id: "tool-1",
      role: "tool",
      content: "Tool result",
      timestamp: "2023-01-01T00:00:00Z",
    };

    expect(toProviderMessages([toolMessage])).toEqual([
      {
        id: "tool-1",
        role: "tool",
        content: "Tool result",
      },
    ]);
    expect(toProviderResponseMessages([toolMessage])).toEqual([toolMessage]);
    expect(
      toProviderResponseMessagePartSource(toProviderResponseMessages([toolMessage])[0]),
    ).toEqual({
      id: "tool-1",
      role: "tool",
      content: "Tool result",
    });
  });
});

describe("automatic tool-result compaction", () => {
  it("preserves numeric lexemes, duplicate keys, escaped strings, and whitespace inside strings", () => {
    const source = String.raw` { "large": 9007199254740993123, "value": -0, "value": 1e999, "text": " a \" b ", "slash": "\\" } `;
    const rewritten = compactJsonWhitespace(source);

    expect(rewritten).toBe(
      String.raw`{"large":9007199254740993123,"value":-0,"value":1e999,"text":" a \" b ","slash":"\\"}`,
    );
  });

  it("leaves malformed JSON, ordinary text, and oversized results unchanged", () => {
    for (const content of [
      "{ broken",
      "  important  text  ",
      '{"text":"' + "a".repeat(1_000_000) + '"}',
    ]) {
      expect(compactJsonWhitespace(content)).toBe(content);
    }
  });

  it("rewrites only eligible tool content without changing history or protocol fields", () => {
    const content = '{ "ok": true }';
    const messages: Message[] = [
      { id: "tool", role: "tool", tool_call_id: "call-1", content },
      { role: "system", content },
      { role: "user", content },
      { role: "assistant", content },
      { role: "tool", content, status: "awaiting_approval" },
      { role: "tool", content: [{ type: "text", text: content }] },
      { role: "tool", content, parts: [{ type: "reasoning", text: content, signature: "signed" }] },
    ];
    const result = messages.map(compactToolOutput);

    expect(result[0]).toMatchObject({ id: "tool", tool_call_id: "call-1", content: '{"ok":true}' });
    expect(messages[0].content).toBe(content);
    expect(result.slice(1)).toEqual(messages.slice(1));
  });

  it("compacts real tool execution parts together without mutating the recorded result", () => {
    const message: Message = {
      role: "tool",
      status: "success",
      name: "lookup",
      tool_call_id: "call-1",
      content: '{ "ok": true }',
    };

    message.parts = buildMessageParts(message);
    const rewritten = compactToolOutput(message);

    expect(rewritten.content).toBe('{"ok":true}');
    expect(rewritten.parts).toMatchObject([
      { type: "text", text: '{"ok":true}' },
      { type: "tool_result", content: '{"ok":true}', toolCallId: "call-1", status: "success" },
    ]);
    expect(message.parts).toMatchObject([
      { type: "text", text: '{ "ok": true }' },
      { type: "tool_result", content: '{ "ok": true }' },
    ]);
    const mixed: Message = {
      ...message,
      parts: [...(message.parts ?? []), { type: "file", url: "https://example.com/result" }],
    };

    expect(compactToolOutput(mixed)).toBe(mixed);
  });
});
