import { describe, expect, it } from "vitest";

import { getPersonalConversationPath, resolvePersonalConversationId } from "./conversation-route";

describe("personal conversation routes", () => {
  it("builds a path URL for a conversation", () => {
    expect(getPersonalConversationPath("conversation/one")).toBe("/chat/conversation%2Fone");
  });

  it("resolves the path ID before the legacy query parameter", () => {
    expect(resolvePersonalConversationId("path-conversation", "?completion_id=legacy")).toBe(
      "path-conversation",
    );
    expect(resolvePersonalConversationId(undefined, "?completion_id=legacy")).toBe("legacy");
  });
});
