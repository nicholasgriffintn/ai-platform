import { describe, expect, it } from "vitest";

import { itemsToMessages, messagesToItems, storedItemSchema } from "./items.js";

describe("items", () => {
  const messages = [
    {
      id: "m1",
      role: "user",
      content: "Hello there",
      created: 1,
      timestamp: 1,
      platform: "web",
    },
    {
      id: "m2",
      role: "user",
      content: [
        { type: "text", text: "Look at this" },
        { type: "image_url", image_url: { url: "https://example.com/a.png", detail: "auto" } },
      ],
    },
    {
      id: "m3",
      role: "assistant",
      content: "Sure.",
      parts: [
        { type: "reasoning", text: "thinking", collapsed: true },
        { type: "text", text: "Sure." },
        { type: "tool_use", name: "get_weather", toolCallId: "call_1", input: { city: "Leeds" } },
      ],
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "get_weather", arguments: "{}" } },
      ],
      model: "gpt",
      provider: "openai",
      usage: { total_tokens: 12 },
      citations: ["https://example.com"],
      status: "completed",
      data: { attachments: [] },
      log_id: "log_1",
      run_id: "run_1",
      provenance: null,
    },
    {
      id: "m4",
      role: "tool",
      name: "get_weather",
      content: '{"temp":12}',
      tool_call_id: "call_1",
      tool_call_arguments: { city: "Leeds" },
      status: "success",
      data: { temp: 12 },
    },
    {
      id: "m5",
      role: "compaction",
      content: "Compacted 4 messages",
      parts: [{ type: "compaction", status: "completed", label: "Compacted" }],
    },
  ];

  it("round-trips stored messages through items without loss", () => {
    const items = messagesToItems(messages);

    for (const item of items) {
      expect(storedItemSchema.safeParse(item).success).toBe(true);
    }

    expect(items.map((item) => item.type)).toEqual([
      "message",
      "message",
      "message",
      "tool_output",
      "compaction",
    ]);
    expect(itemsToMessages(items)).toEqual(messages);
  });

  it("projects tool messages onto tool_output items", () => {
    const [item] = messagesToItems([messages[3]]);

    expect(item).toMatchObject({
      type: "tool_output",
      call_id: "call_1",
      name: "get_weather",
      arguments: { city: "Leeds" },
      content: [{ type: "text", text: '{"temp":12}' }],
      data: { temp: 12 },
      status: "success",
    });
  });

  it("keeps message metadata out of the content", () => {
    const [item] = messagesToItems([messages[2]]);

    expect(item.type).toBe("message");
    expect(item.content).toEqual([{ type: "text", text: "Sure." }]);
    expect(item.metadata).toMatchObject({ model: "gpt", provider: "openai", run_id: "run_1" });
    expect(item.metadata).not.toHaveProperty("content");
    expect(item.metadata).not.toHaveProperty("parts");
  });
});
