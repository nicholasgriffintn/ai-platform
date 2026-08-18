import { describe, expect, it } from "vitest";

import { createConversationTitleExcerpt, DEFAULT_CONVERSATION_TITLE } from "./conversation-title";

describe("createConversationTitleExcerpt", () => {
  it("returns a concise excerpt with normalised whitespace", () => {
    expect(
      createConversationTitleExcerpt("  Help me\nbrainstorm creative uses for bottles  "),
    ).toBe("Help me brainstorm creative us...");
  });

  it("does not add an ellipsis to a short title", () => {
    expect(createConversationTitleExcerpt("Plan a holiday")).toBe("Plan a holiday");
  });

  it("returns the default title when there is no text", () => {
    expect(createConversationTitleExcerpt("   ")).toBe(DEFAULT_CONVERSATION_TITLE);
  });
});
