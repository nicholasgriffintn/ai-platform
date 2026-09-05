import { describe, expect, it } from "vitest";

import { isConversationUnread } from "./conversation-organisation";

describe("isConversationUnread", () => {
  it("treats a response that wakes a next-response snooze as unread", () => {
    expect(isConversationUnread({ is_unread: 0, next_response_arrived: 1 })).toBe(true);
  });

  it("keeps explicit unread state and otherwise remains read", () => {
    expect(isConversationUnread({ is_unread: 1, next_response_arrived: 0 })).toBe(true);
    expect(isConversationUnread({ is_unread: 0, next_response_arrived: 0 })).toBe(false);
    expect(isConversationUnread(undefined)).toBe(false);
  });
});
