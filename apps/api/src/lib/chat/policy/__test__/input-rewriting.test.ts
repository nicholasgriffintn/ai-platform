import { describe, expect, it } from "vitest";

import { buildMessageParts } from "~/lib/chat/messages/parts";
import type { Message } from "~/types";
import { compactJsonWhitespace } from "~/utils/json";

import { previewInputRewrite, rewriteChatInput, rewriteToolMessages } from "../input-rewriting";

const compact = { toolOutputRewriting: "compact_json" } as const;

describe("lossless tool-result rewriting", () => {
  it("applies the default rewrite to chat calls without a saved user scope", async () => {
    const messages: Message[] = [{ role: "tool", status: "success", content: '{ "ok": true }' }];

    expect((await rewriteChatInput({ messages }))[0].content).toBe('{"ok":true}');
    expect(messages[0].content).toBe('{ "ok": true }');
  });

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
    const result = rewriteToolMessages(messages, compact);

    expect(result[0]).toMatchObject({ id: "tool", tool_call_id: "call-1", content: '{"ok":true}' });
    expect(messages[0].content).toBe(content);
    expect(result.slice(1)).toEqual(messages.slice(1));
    expect(rewriteToolMessages(messages, { toolOutputRewriting: "off" })).toBe(messages);
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
    const [rewritten] = rewriteToolMessages([message], compact);

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

    expect(rewriteToolMessages([mixed], compact)[0]).toBe(mixed);
  });

  it("uses the same transform for a read-only preview and reports estimated savings", () => {
    const content = '{\n  "ok": true\n}';
    const result = previewInputRewrite(compact, content);

    expect(result.content).toBe('{"ok":true}');
    expect(result.changed).toBe(true);
    expect(result.estimatedTokensSaved).toBeGreaterThan(0);
    expect(result.originalCharacters).toBe(content.length);
    expect(result.rewrittenCharacters).toBe(result.content.length);
    expect(previewInputRewrite({ toolOutputRewriting: "off" }, content).estimatedTokensSaved).toBe(
      0,
    );
  });
});
