import { describe, expect, it } from "vitest";

import { createAgentProviderIO, toolChoiceForStep } from "../provider-io";

describe("toolChoiceForStep", () => {
  const forced = { type: "function", function: { name: "second_opinion" } };

  it("forces a tool on the first step only, so the model can answer afterwards", () => {
    expect(toolChoiceForStep(forced, 1)).toBe(forced);
    expect(toolChoiceForStep(forced, 2)).toBe("auto");
    expect(toolChoiceForStep("required", 2)).toBe("auto");
  });

  it("keeps tools off on every step", () => {
    expect(toolChoiceForStep("none", 2)).toBe("none");
  });
});

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
