import { describe, expect, it } from "vitest";

import { prefersEventStream, toEventStreamResponse } from "../transport";

describe("MCP Streamable HTTP transport", () => {
  it("streams only when the client accepts event streams and not JSON", () => {
    expect(prefersEventStream("text/event-stream")).toBe(true);
    expect(prefersEventStream("text/event-stream; charset=utf-8")).toBe(true);
    expect(prefersEventStream("application/json, text/event-stream")).toBe(false);
    expect(prefersEventStream("*/*")).toBe(false);
    expect(prefersEventStream(null)).toBe(false);
  });

  it("writes each JSON-RPC response as one server-sent event", async () => {
    const response = toEventStreamResponse([
      { jsonrpc: "2.0", id: 1, result: { tools: [] } },
      { jsonrpc: "2.0", id: 2, result: {} },
    ]);

    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(await response.text()).toBe(
      'data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\ndata: {"jsonrpc":"2.0","id":2,"result":{}}\n\n',
    );
  });
});
