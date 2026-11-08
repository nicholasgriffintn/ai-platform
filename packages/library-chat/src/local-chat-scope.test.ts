import { describe, expect, it } from "vitest";

import { getLocalChatScope, isConversationInLocalScope } from "./local-chat-scope.js";

const conversation = { id: "conversation-1", title: "Private", messages: [] };

describe("local chat scope", () => {
  it("isolates signed-in users on a shared browser profile", () => {
    expect(
      isConversationInLocalScope(
        { ...conversation, localOwnerScope: getLocalChatScope(42) },
        getLocalChatScope(7),
      ),
    ).toBe(false);
  });
});
