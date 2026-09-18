import { describe, expect, it, vi } from "vitest";

import { prependConnectorReplayToStream } from "../connectorApprovalReplayResponse";

describe("prependConnectorReplayToStream", () => {
  it("propagates consumer cancellation through the locked source reader", async () => {
    const cancel = vi.fn();
    const source = new ReadableStream<Uint8Array>({
      pull() {
        return new Promise(() => undefined);
      },
      cancel,
    });
    const stream = prependConnectorReplayToStream({
      stream: source,
      toolCall: {
        id: "call-1",
        type: "function",
        function: {
          name: "use_recipe_connector",
          arguments: '{"provider":"gmail","operation":"GMAIL_CREATE_DRAFT","sessionId":"ccs_1"}',
        },
      },
      toolResult: {
        id: "result-1",
        role: "tool",
        name: "use_recipe_connector",
        content: "Created",
      },
    });
    const reader = stream.getReader();

    await reader.read();
    await reader.cancel("client disconnected");

    expect(cancel).toHaveBeenCalledWith("client disconnected");
  });
});
