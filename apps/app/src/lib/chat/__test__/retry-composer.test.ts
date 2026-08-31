import { describe, expect, it } from "vitest";

import { getComposerDraftAfterRetry } from "../retry-composer";

describe("getComposerDraftAfterRetry", () => {
  it("clears the draft restored from the user message being retried", () => {
    expect(
      getComposerDraftAfterRetry("Try this again", [
        { role: "user", content: "Try this again" },
        { role: "assistant", content: "Earlier response" },
      ]),
    ).toBe("");
  });

  it("preserves a different draft the user started after the failed message", () => {
    expect(
      getComposerDraftAfterRetry("A new thought", [
        { role: "user", content: "Try this again" },
        { role: "assistant", content: "Earlier response" },
      ]),
    ).toBe("A new thought");
  });
});
