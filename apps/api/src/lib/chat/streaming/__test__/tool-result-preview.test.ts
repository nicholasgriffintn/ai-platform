import { describe, expect, it } from "vitest";

import type { Message } from "~/types";

import { createStreamedToolResultEvent } from "../tool-result-preview";

function toolMessage(content: string, data: Record<string, unknown> = {}): Message {
  return {
    id: "tool-message-1",
    role: "tool",
    name: "search",
    status: "success",
    content,
    data,
  };
}

describe("createStreamedToolResultEvent", () => {
  it("passes ordinary tool results through unchanged", () => {
    const message = toolMessage("small result");

    expect(createStreamedToolResultEvent(message)).toEqual({
      tool_id: message.id,
      result: message,
    });
  });

  it("streams a bounded preview while retaining recovery and interaction metadata", () => {
    const message = toolMessage("x".repeat(96 * 1024), {
      responseType: "text",
      humanInTheLoop: { type: "approval", status: "pending" },
      providerPayload: "y".repeat(96 * 1024),
    });
    const event = createStreamedToolResultEvent(message);

    expect(new TextEncoder().encode(JSON.stringify(event)).byteLength).toBeLessThan(64 * 1024);
    expect(event.result.content).toContain("[Live preview truncated]");
    expect(event.result.data).toMatchObject({
      responseType: "text",
      humanInTheLoop: { type: "approval", status: "pending" },
      streamPreview: {
        truncated: true,
        fullMessageId: "tool-message-1",
        previewCharacters: 32 * 1024,
      },
    });
    expect(event.result.data).not.toHaveProperty("providerPayload");
    expect(message.content).toHaveLength(96 * 1024);
    expect(message.data?.providerPayload).toHaveLength(96 * 1024);
  });

  it("keeps pathological presentation metadata inside the event ceiling", () => {
    const event = createStreamedToolResultEvent(
      toolMessage("x".repeat(96 * 1024), {
        attachments: Array.from({ length: 1000 }, (_, index) => ({
          name: `attachment-${index}`,
          url: `https://example.com/${"x".repeat(200)}`,
        })),
        humanInTheLoop: {
          interactionId: "interaction-1",
          requires_user_action: true,
          status: "pending",
          type: "approval",
        },
      }),
    );

    expect(new TextEncoder().encode(JSON.stringify(event)).byteLength).toBeLessThan(64 * 1024);
    expect(event.result.data).toMatchObject({
      humanInTheLoop: {
        interactionId: "interaction-1",
        requires_user_action: true,
        status: "pending",
        type: "approval",
      },
      streamPreview: { truncated: true, fullMessageId: "tool-message-1" },
    });
    expect(event.result.data).not.toHaveProperty("attachments");
  });

  it("counts non-ASCII output against the byte ceiling", () => {
    const event = createStreamedToolResultEvent(toolMessage("🦎".repeat(96 * 1024)));

    expect(new TextEncoder().encode(JSON.stringify(event)).byteLength).toBeLessThan(64 * 1024);
  });
});
