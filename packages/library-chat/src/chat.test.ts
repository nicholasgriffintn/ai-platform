import { describe, expect, it } from "vitest";

import { isCompactConversationCommand } from "./compaction-command";
import {
  filterConversationsByListOptions,
  preserveOptimisticMessages,
  type ConversationWithMessages,
} from "./conversations";
import { mergeChatRequestOptions } from "./request-options";

describe("chat policies", () => {
  it("preserves project metadata while merging request options", () => {
    expect(
      mergeChatRequestOptions(
        { metadata: { project_id: "project-1" }, options: { agent: { minToolCalls: 1 } } },
        { metadata: { recipe_id: "recipe-1" } },
      ),
    ).toMatchObject({ metadata: { project_id: "project-1", recipe_id: "recipe-1" } });
  });

  it("normalises the compact command", () => {
    expect(isCompactConversationCommand("  /COMPACT ")).toBe(true);
  });

  it("filters summaries without changing their concrete type", () => {
    const conversations = [
      { id: "old", title: "Old", updated_at: "2025-01-01", is_archived: false, marker: 1 },
      { id: "new", title: "New", updated_at: "2026-01-01", is_archived: false, marker: 2 },
    ];

    expect(filterConversationsByListOptions(conversations).map((item) => item.marker)).toEqual([
      2, 1,
    ]);
  });

  it("keeps cached streaming content when the fetched conversation is behind", () => {
    const fetched: ConversationWithMessages = { title: "Chat", messages: [] };
    const cached: ConversationWithMessages = {
      title: "Chat",
      messages: [{ role: "assistant", content: "Streaming" }],
    };

    expect(preserveOptimisticMessages(fetched, cached)?.messages).toEqual(cached.messages);
  });
});
