import { describe, expect, it } from "vitest";

import { clearModelResponseSettings } from "./chat-settings.js";

describe("chat response token defaults", () => {
  it("drops the previous model's response settings but keeps the rest", () => {
    expect(
      clearModelResponseSettings({
        max_tokens: 65_536,
        temperature: 0.7,
        reasoning: { effort: "high" },
        service_tier: "fast",
        verbosity: "low",
      }),
    ).toEqual({ max_tokens: 65_536, temperature: 0.7 });
  });
});
