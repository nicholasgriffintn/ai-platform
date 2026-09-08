import { describe, expect, it } from "vitest";

import { getPersonalConversationPath } from "./conversation-route.js";

describe("personal conversation routes", () => {
  it("builds a path URL for a conversation", () => {
    expect(getPersonalConversationPath("conversation/one")).toBe("/chat/conversation%2Fone");
  });
});
