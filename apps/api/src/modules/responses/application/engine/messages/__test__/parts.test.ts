import { describe, expect, it } from "vitest";

import { formatStoredMessage } from "~/modules/conversations/application/stored-message";

import { buildMessageParts } from "../parts";

describe("tool message parts", () => {
  it("serialises a tool result once while retaining its payload and call identity", () => {
    const data = { places: [{ label: "Waterloo Underground Station" }] };
    const parts = buildMessageParts({
      role: "tool",
      name: "search_places",
      content: "Matching places",
      tool_call_id: "call-1",
      data,
    });

    expect(parts).toEqual([
      expect.objectContaining({
        type: "tool_result",
        content: "Matching places",
        toolCallId: "call-1",
        data,
      }),
    ]);
  });

  it("removes the duplicate text part when loading an older stored tool result", () => {
    const message = formatStoredMessage({
      id: "tool-1",
      role: "tool",
      name: "use_recipe_connector",
      content: "Connector operation completed",
      data: JSON.stringify({ journeys: [] }),
      parts: JSON.stringify([
        { type: "text", text: "Connector operation completed" },
        { type: "tool_result", content: "Connector operation completed" },
      ]),
    });

    expect(message.parts).toEqual([
      expect.objectContaining({
        type: "tool_result",
        content: "Connector operation completed",
        data: { journeys: [] },
      }),
    ]);
  });
});
