import { describe, expect, it } from "vitest";

import type { Message } from "~/types/chat";

import { buildMessageParts } from "../parts";

describe("buildMessageParts", () => {
  it("names a tool result carried in a content array", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_result",
          name: "get_weather",
          tool_use_id: "call-1",
          content: "Mild",
        },
      ],
    } as unknown as Message;

    expect(buildMessageParts(message)).toContainEqual(
      expect.objectContaining({
        type: "tool_result",
        name: "get_weather",
        toolCallId: "call-1",
        content: "Mild",
      }),
    );
  });

  it("carries name and data from a role:tool message", () => {
    const message = {
      role: "tool",
      name: "web_search",
      status: "success",
      content: "Found 3 results",
      tool_call_id: "call-2",
      data: { renderer: "web_search", icon: "search" },
    } as unknown as Message;

    expect(buildMessageParts(message)).toContainEqual(
      expect.objectContaining({
        type: "tool_result",
        name: "web_search",
        status: "success",
        toolCallId: "call-2",
        data: { renderer: "web_search", icon: "search" },
      }),
    );
  });
});
