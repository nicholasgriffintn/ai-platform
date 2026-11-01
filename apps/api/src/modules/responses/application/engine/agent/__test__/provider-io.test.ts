import { describe, expect, it } from "vitest";

import { createAgentProviderIO } from "../provider-io";

describe("providerMessages", () => {
  it("keeps tool result data so the model sees what the tool returned", () => {
    const [message] = createAgentProviderIO().providerMessages([
      {
        role: "tool",
        name: "web_search",
        tool_call_id: "call_1",
        content: "Web search completed",
        data: { sources: [{ url: "https://example.com/d1" }] },
      },
    ]);

    expect(message?.data).toEqual({ sources: [{ url: "https://example.com/d1" }] });
  });
});
